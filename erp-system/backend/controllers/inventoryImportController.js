const multer = require('multer');
const XLSX   = require('xlsx');
const path   = require('path');
const db     = require('../config/db');
const { updateShopStock, getShopStockForUpdate } = require('./inventoryController');

// ── Upload middleware (memory storage, .xls/.xlsx only) ──────────────
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xls', '.xlsx'].includes(ext)) cb(null, true);
    else cb(new Error('Only .xls / .xlsx files are allowed'));
};
exports.uploadMiddleware = multer({ storage, fileFilter, limits: { fileSize: 15 * 1024 * 1024 } }).single('file');

// ── Flexible column lookup (case/space-insensitive, several aliases) ─
function pick(row, aliases) {
    const keys = Object.keys(row);
    for (const alias of aliases) {
        const norm = alias.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const found = keys.find(k => k.replace(/[^a-z0-9]/gi, '').toLowerCase() === norm);
        if (found !== undefined && row[found] !== undefined && row[found] !== '') return row[found];
    }
    return undefined;
}
function toNumber(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(String(v).replace(/[,₹\s]/g, ''));
    return Number.isFinite(n) ? n : null;
}

// Sheets sometimes carry a "Generated on ..." title row (and a blank row)
// above the real header row. Find the row that actually contains the
// expected header labels and re-parse from there instead of assuming
// row 1 is the header.
function parseSheetRows(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headerIdx = raw.findIndex(r =>
        r.some(cell => /item\s*name|product\s*name/i.test(String(cell)))
    );
    if (headerIdx === -1) return XLSX.utils.sheet_to_json(sheet, { defval: '' }); // fallback: assume row 1
    const headers = raw[headerIdx].map(h => String(h).trim());
    return raw.slice(headerIdx + 1)
        .filter(r => r.some(c => c !== ''))
        .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] !== undefined ? r[i] : ''])));
}

/* ══════════════════════════════════════════════════════════════════
   POST /api/inventory/import-excel  (multipart: file, shop_id)
   Imports item-wise stock for ONE shop per upload (this Excel export
   format carries no Shop Name column — the shop is chosen at upload
   time and applies to every row in the file). Matches products by
   Article Code/SKU first, then name, to avoid duplicates. Rows with
   the same item name but a different sale/purchase price pair are
   treated as distinct variants (no separate size/color column exists
   in this format), matched deterministically on price on re-import
   so re-uploading the same file never creates duplicate variants.
══════════════════════════════════════════════════════════════════ */
exports.importShopStock = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Excel file is required (field name: file)' });
    const shopId = req.body.shop_id;
    if (!shopId) return res.status(400).json({ error: 'shop_id is required' });

    let rows;
    try {
        rows = parseSheetRows(req.file.buffer);
    } catch (e) {
        return res.status(400).json({ error: 'Could not read Excel file: ' + e.message });
    }
    if (!rows.length) return res.status(400).json({ error: 'Excel file has no data rows' });

    const summary = {
        total_rows: rows.length,
        processed: 0,
        products_created: 0,
        products_updated: 0,
        shop_stock_upserts: 0,
        rows_skipped: 0,
        errors: [],
    };

    const shopRes = await db.query('SELECT id, shop_name FROM shops WHERE id=$1', [shopId]);
    if (!shopRes.rows.length) return res.status(400).json({ error: 'Selected shop not found' });
    const shop = shopRes.rows[0];

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        for (let idx = 0; idx < rows.length; idx++) {
            const rowNum = idx + 2;
            const row = rows[idx];
            // Each row gets its own SAVEPOINT — a bad row (bad data, a
            // constraint violation, etc.) rolls back only that row's
            // work instead of aborting every row already processed in
            // this transaction.
            await client.query('SAVEPOINT row_import');
            try {
                const itemName    = pick(row, ['Item Name', 'Product Name', 'Item', 'Product']);
                const articleCode = pick(row, ['Article Code', 'SKU', 'Article Code/SKU', 'Code']);
                const salePrice   = toNumber(pick(row, ['Sale Price', 'SalePrice', 'MRP']));
                const purchasePrice = toNumber(pick(row, ['Purchase Price', 'PurchasePrice', 'Cost Price']));
                const qty         = toNumber(pick(row, ['Item Stock Quantity', 'Item Stock Quanti', 'Stock Quantity', 'Quantity', 'Qty', 'Stock']));
                const category    = pick(row, ['Category']);
                const unit         = pick(row, ['Unit']) || 'pcs';
                const gstRate      = toNumber(pick(row, ['GST%', 'GST', 'GST Rate', 'Tax%']));
                const size         = pick(row, ['Size']);
                const color        = pick(row, ['Color', 'Colour']);
                const variantInfo  = pick(row, ['Variant', 'Variant Info', 'Size/Color']);

                if (!itemName) throw new Error('Item Name is missing');
                if (qty === null || qty < 0) throw new Error('Item Stock Quantity is missing/invalid');
                if (salePrice !== null && salePrice < 0)         throw new Error('Sale Price is invalid');
                if (purchasePrice !== null && purchasePrice < 0) throw new Error('Purchase Price is invalid');

                // ── Category (create if missing, additive only) ─────
                let categoryId = null;
                if (category) {
                    const cRes = await client.query('SELECT id FROM inv_categories WHERE LOWER(name)=LOWER($1)', [category]);
                    if (cRes.rows.length) categoryId = cRes.rows[0].id;
                    else categoryId = (await client.query('INSERT INTO inv_categories (name) VALUES ($1) RETURNING id', [category])).rows[0].id;
                }

                // ── Product: Article Code/SKU first, then name ──────
                let product = null;
                if (articleCode) {
                    const pRes = await client.query(`SELECT * FROM inv_products WHERE LOWER(article_code)=LOWER($1) LIMIT 1`, [articleCode]);
                    if (pRes.rows.length) product = pRes.rows[0];
                }
                if (!product) {
                    const pRes = await client.query(`SELECT * FROM inv_products WHERE LOWER(name)=LOWER($1) LIMIT 1`, [itemName]);
                    if (pRes.rows.length) product = pRes.rows[0];
                }
                if (!product) {
                    const created = await client.query(
                        `INSERT INTO inv_products (name, category_id, article_code, unit, gst_rate, sale_price, purchase_price, created_by)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                        [itemName, categoryId, articleCode || null, unit, gstRate || 0, salePrice, purchasePrice, req.user.id]
                    );
                    product = created.rows[0];
                    summary.products_created++;
                } else {
                    summary.products_updated++;
                }

                // ── Variant: SKU > explicit size/color > price-pair signature ──
                let variant = null;
                if (articleCode) {
                    const vRes = await client.query(`SELECT * FROM inv_variants WHERE LOWER(sku)=LOWER($1) LIMIT 1`, [articleCode]);
                    if (vRes.rows.length) variant = vRes.rows[0];
                }
                if (!variant && (size || color)) {
                    const vRes = await client.query(
                        `SELECT * FROM inv_variants WHERE product_id=$1
                         AND COALESCE(size,'')=COALESCE($2,'') AND COALESCE(color,'')=COALESCE($3,'') LIMIT 1`,
                        [product.id, size || variantInfo || null, color || null]
                    );
                    if (vRes.rows.length) variant = vRes.rows[0];
                }
                if (!variant && !size && !color && !articleCode) {
                    // No identifying column at all — this Excel export
                    // distinguishes variants only by their price pair.
                    const vRes = await client.query(
                        `SELECT * FROM inv_variants WHERE product_id=$1
                         AND sale_price = $2 AND purchase_price = $3 LIMIT 1`,
                        [product.id, salePrice || 0, purchasePrice || 0]
                    );
                    if (vRes.rows.length) variant = vRes.rows[0];
                }
                if (!variant) {
                    const created = await client.query(
                        `INSERT INTO inv_variants (product_id, size, color, sku, purchase_price, sale_price, mrp)
                         VALUES ($1,$2,$3,$4,$5,$6,$7)
                         ON CONFLICT (sku) DO NOTHING RETURNING *`,
                        [product.id, size || variantInfo || null, color || null, articleCode || null,
                         purchasePrice || 0, salePrice || 0, salePrice || 0]
                    );
                    if (created.rows.length) {
                        variant = created.rows[0];
                        await client.query(`INSERT INTO inv_stock (variant_id, qty) VALUES ($1,0) ON CONFLICT DO NOTHING`, [variant.id]);
                    } else if (articleCode) {
                        const vRes = await client.query(`SELECT * FROM inv_variants WHERE LOWER(sku)=LOWER($1) LIMIT 1`, [articleCode]);
                        variant = vRes.rows[0];
                    }
                }
                if (!variant) throw new Error('Could not resolve/create a product variant for this row');

                // ── Upsert shop stock: import sets the ABSOLUTE qty for that shop (snapshot import) ──
                const currentQty = await getShopStockForUpdate(client, shopId, variant.id);
                const delta = qty - currentQty;
                await updateShopStock(client, shopId, variant.id, delta, 'import', 'excel_import', null,
                    `Excel import row ${rowNum} (${shop.shop_name})`, req.user.id);
                await client.query(
                    `UPDATE inv_shop_stock SET purchase_price=$1, sale_price=$2 WHERE shop_id=$3 AND variant_id=$4`,
                    [purchasePrice, salePrice, shopId, variant.id]
                );
                summary.shop_stock_upserts++;
                summary.processed++;
                await client.query('RELEASE SAVEPOINT row_import');
            } catch (rowErr) {
                await client.query('ROLLBACK TO SAVEPOINT row_import');
                summary.rows_skipped++;
                summary.errors.push({ row: rowNum, error: rowErr.message });
            }
        }

        await client.query(
            `INSERT INTO inv_stock_imports (filename, total_rows, processed, products_created, products_updated,
                shop_stock_upserts, rows_skipped, error_count, errors, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [req.file.originalname, summary.total_rows, summary.processed, summary.products_created,
             summary.products_updated, summary.shop_stock_upserts, summary.rows_skipped,
             summary.errors.length, JSON.stringify(summary.errors), req.user.id]
        );

        await client.query('COMMIT');
        res.json({ ...summary, shop_name: shop.shop_name });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Import failed: ' + e.message, ...summary });
    } finally { client.release(); }
};
