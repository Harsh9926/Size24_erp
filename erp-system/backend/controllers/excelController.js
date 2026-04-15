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

/* ── Helper: extract date from filename ─────────────────────────── */
function extractDateFromFilename(filename) {
    // Match patterns like 2025-04-15, 15-04-2025, 15/04/2025, 20250415
    const patterns = [
        /(\d{4}[-\/]\d{2}[-\/]\d{2})/,   // YYYY-MM-DD
        /(\d{2}[-\/]\d{2}[-\/]\d{4})/,   // DD-MM-YYYY
        /(\d{8})/,                         // YYYYMMDD
    ];
    for (const re of patterns) {
        const m = filename.match(re);
        if (m) {
            const raw = m[1].replace(/\//g, '-');
            // Check DD-MM-YYYY
            if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
                const [d, mo, y] = raw.split('-');
                return `${y}-${mo}-${d}`;
            }
            // Check YYYYMMDD
            if (/^\d{8}$/.test(raw)) {
                return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
            }
            return raw; // YYYY-MM-DD
        }
    }
    return null;
}

/* ── POST /api/excel/upload ─────────────────────────────────────── */
exports.processExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

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

        /* Extract date: prefer the raw "Date" row above headers, then filename, then today */
        let uploadDate = null;

        /* Look for a date value in rows above the header row */
        for (let i = 0; i < headerRowIndex; i++) {
            const row = rawRows[i];
            if (!Array.isArray(row)) continue;
            for (const cell of row) {
                if (cell instanceof Date) {
                    uploadDate = cell.toISOString().split('T')[0];
                    break;
                }
                if (typeof cell === 'string' || typeof cell === 'number') {
                    const d = new Date(cell);
                    if (!isNaN(d.getTime()) && String(cell).length >= 8) {
                        uploadDate = d.toISOString().split('T')[0];
                        break;
                    }
                }
            }
            if (uploadDate) break;
        }

        /* Also check "Date" column in data rows as fallback */
        if (!uploadDate) {
            const dateKey = headers.find(h => h.trim().toLowerCase() === 'date');
            if (dateKey && rows[0][dateKey]) {
                const raw = rows[0][dateKey];
                if (raw instanceof Date) {
                    uploadDate = raw.toISOString().split('T')[0];
                } else {
                    const d = new Date(raw);
                    if (!isNaN(d.getTime())) uploadDate = d.toISOString().split('T')[0];
                }
            }
        }

        if (!uploadDate) {
            uploadDate = extractDateFromFilename(req.file.originalname);
        }

        if (!uploadDate) {
            uploadDate = new Date().toISOString().split('T')[0];
        }

        /* Get optional shopId from body */
        const shopId = req.body.shop_id ? parseInt(req.body.shop_id) : null;

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
