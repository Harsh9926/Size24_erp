const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const db = require('../config/db');

/* ── Multer: memory storage for Excel files ─────────────────────── */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xls', '.xlsx'].includes(ext)) cb(null, true);
    else cb(new Error('Only .xls / .xlsx files are allowed'));
};

exports.uploadExcel = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/* ── Helper: parse a date value from various Excel formats ───────── */
function parseExcelDate(raw) {
    if (raw == null) return null;
    if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw.toISOString().split('T')[0];

    const str = String(raw).trim();

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        const iso = `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
        return isNaN(new Date(iso).getTime()) ? null : iso;
    }

    // YYYY-MM-DD or YYYY/MM/DD
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
        const iso = `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
        return isNaN(new Date(iso).getTime()) ? null : iso;
    }

    // YYYYMMDD (8 digits)
    if (/^\d{8}$/.test(str)) {
        const iso = `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
        return isNaN(new Date(iso).getTime()) ? null : iso;
    }

    // Generic JS Date fallback (handles ISO strings, etc.)
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

/* ── Helper: today's date in IST (UTC +5:30) ─────────────────────── */
function getTodayIST() {
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split('T')[0];
}

/* ── GET /api/excel/check-today ─────────────────────────────────── */
exports.checkToday = async (req, res) => {
    const shopId = req.query.shop_id
        ? parseInt(req.query.shop_id)
        : (req.user.shopId || null);

    if (!shopId) return res.json({ already_submitted: false });

    try {
        const result = await db.query(
            `SELECT eu.id, eu.total_sale, eu.created_at, u.name AS submitted_by
             FROM excel_uploads eu
             LEFT JOIN users u ON u.id = eu.user_id
             WHERE eu.shop_id = $1 AND eu.created_at::date = CURRENT_DATE
             ORDER BY eu.created_at DESC
             LIMIT 1`,
            [shopId]
        );

        if (result.rows.length === 0) return res.json({ already_submitted: false });

        const row = result.rows[0];
        return res.json({
            already_submitted: true,
            submitted_by:      row.submitted_by || 'Unknown',
            submitted_at:      row.created_at,
            total_sale:        parseFloat(row.total_sale),
            upload_id:         row.id,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ── POST /api/excel/upload ─────────────────────────────────────── */
exports.processExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        /* ── Duplicate-upload guard ──────────────────────────────────
           One Excel per shop per calendar day.
           Admins can bypass by sending force=true in the body.
        ─────────────────────────────────────────────────────────── */
        const shopId = req.body.shop_id ? parseInt(req.body.shop_id) : (req.user.shopId || null);
        const isAdmin = req.user.role === 'admin';
        const force   = req.body.force === 'true' || req.body.force === true;

        if (shopId && !(isAdmin && force)) {
            const dupCheck = await db.query(
                `SELECT eu.id, eu.created_at, u.name AS submitted_by
                 FROM excel_uploads eu
                 LEFT JOIN users u ON u.id = eu.user_id
                 WHERE eu.shop_id = $1 AND eu.created_at::date = CURRENT_DATE
                 ORDER BY eu.created_at DESC
                 LIMIT 1`,
                [shopId]
            );
            if (dupCheck.rows.length > 0) {
                const dup = dupCheck.rows[0];
                return res.status(409).json({
                    success:      false,
                    message:      "Today's report already submitted",
                    submitted_by: dup.submitted_by || 'Unknown',
                    submitted_at: dup.created_at,
                    upload_id:    dup.id,
                });
            }
        }

        /* Parse workbook */
        const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) return res.status(400).json({ error: 'Excel file has no sheets' });

        const ws = wb.Sheets[sheetName];

        /* ── Dynamic header detection ───────────────────────────────
           Read all rows as raw arrays, then find the row that
           contains "Received Amount" — use that row as the header.
           This handles Excel files where extra rows (e.g. a "Date"
           label row) appear above the real column headers.
        ─────────────────────────────────────────────────────────── */
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        const headerRowIndex = rawRows.findIndex(row =>
            Array.isArray(row) &&
            row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'received amount')
        );

        if (headerRowIndex === -1) {
            return res.status(422).json({
                error: "Invalid Excel format. 'Received Amount' column not found."
            });
        }

        /* Parse again starting from the detected header row */
        const rows = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex, defval: null });

        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty or has no data rows' });
        }

        const headers = Object.keys(rows[0]);
        const amtKey = headers.find(h => h.trim().toLowerCase() === 'received amount');

        /* Calculate total sale */
        let totalSale = 0;
        for (const row of rows) {
            const val = parseFloat(String(row[amtKey] ?? '').replace(/[₹,\s]/g, ''));
            if (!isNaN(val)) totalSale += val;
        }

        /* ── Date validation: read ONLY from the "Date" column in data rows ──
           Pre-header row scanning is intentionally absent — a report-generation
           timestamp or title row could contain today's date and falsely pass
           validation even when the transaction rows carry an old date.           The "Date" column is MANDATORY. Missing column or empty values → 422. */
        const dateKey = headers.find(h => h.trim().toLowerCase() === 'date');

        if (!dateKey) {
            return res.status(422).json({
                success: false,
                message: "Upload failed: 'Date' column is missing from the Excel file.",
            });
        }

        let uploadDate = null;
        for (const row of rows) {
            const parsed = parseExcelDate(row[dateKey]);
            if (parsed) { uploadDate = parsed; break; }
        }

        if (!uploadDate) {
            return res.status(422).json({
                success: false,
                message: "Upload failed: 'Date' column found but contains no valid date value. " +
                         "Ensure dates are in DD/MM/YYYY or YYYY-MM-DD format.",
            });
        }

        const todayIST = getTodayIST();
        if (uploadDate !== todayIST) {
            return res.status(422).json({
                success: false,
                message: "Upload failed: Excel date must match today's date.",
            });
        }

        /* Limit row_data to 500 rows to avoid huge JSONB */
        const rowData = rows.slice(0, 500);

        /* Save to DB */
        const result = await db.query(
            `INSERT INTO excel_uploads (user_id, shop_id, filename, upload_date, total_sale, row_data)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, upload_date, total_sale, filename, created_at`,
            [req.user.id, shopId, req.file.originalname, uploadDate, totalSale, JSON.stringify(rowData)]
        );

        const saved = result.rows[0];

        res.json({
            message: 'Excel processed successfully',
            id: saved.id,
            filename: saved.filename,
            totalSale: parseFloat(saved.total_sale),
            uploadDate: saved.upload_date,
            createdAt: saved.created_at,
            rowCount: rows.length,
            preview: rows.slice(0, 100), // first 100 rows for UI preview
        });

    } catch (err) {
        console.error('Excel upload error:', err);
        res.status(500).json({ error: err.message || 'Failed to process Excel file' });
    }
};

/* ── GET /api/excel/history ─────────────────────────────────────── */
exports.getHistory = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const result = await db.query(
            `SELECT eu.id, eu.filename, eu.upload_date, eu.total_sale, eu.created_at,
                    u.name AS uploaded_by, s.shop_name
             FROM excel_uploads eu
             LEFT JOIN users u ON u.id = eu.user_id
             LEFT JOIN shops s ON s.id = eu.shop_id
             ORDER BY eu.created_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};

/* ── GET /api/excel/:id ─────────────────────────────────────────── */
exports.getOne = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT eu.*, u.name AS uploaded_by, s.shop_name
             FROM excel_uploads eu
             LEFT JOIN users u ON u.id = eu.user_id
             LEFT JOIN shops s ON s.id = eu.shop_id
             WHERE eu.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch record' });
    }
};
