const db = require('../config/db');

// ── SKU Generator ────────────────────────────────────────────────────
// Format: CAT-GEN-SIZE-COLOR-SEQ  e.g. UNF-BOY-28-BLU-001
function generateSKU(parts) {
    const slug = (s) => (s || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const seq  = String(parts.seq || 1).padStart(3, '0');
    return [slug(parts.category), slug(parts.gender), slug(parts.size), slug(parts.color), seq].join('-');
}

// ── Barcode Generator ────────────────────────────────────────────────
// 13-digit EAN-style numeric code: 890 (India) + 5-digit product + 4-digit variant + check
function generateBarcode(productId, variantSeq) {
    const base = `890${String(productId).padStart(5, '0')}${String(variantSeq).padStart(4, '0')}`;
    // EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return base + check;
}

/* ═══════════════════ COLORS ═══════════════════════════════════════ */
exports.getColors = async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM pm_colors WHERE is_active = true ORDER BY name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createColor = async (req, res) => {
    const { name, hex_code } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO pm_colors (name, hex_code) VALUES ($1,$2) RETURNING *`,
            [name, hex_code || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateColor = async (req, res) => {
    const { id } = req.params;
    const { name, hex_code, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE pm_colors SET name=$1, hex_code=$2, is_active=$3 WHERE id=$4 RETURNING *`,
            [name, hex_code, is_active ?? true, id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ GENDERS ══════════════════════════════════════ */
exports.getGenders = async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM pm_genders WHERE is_active = true ORDER BY name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createGender = async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(`INSERT INTO pm_genders (name) VALUES ($1) RETURNING *`, [name]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ HOUSES ═══════════════════════════════════════ */
exports.getHouses = async (req, res) => {
    try {
        const r = await db.query(
            `SELECT h.*, s.name AS school_name
             FROM pm_houses h
             LEFT JOIN inv_schools s ON s.id = h.school_id
             WHERE h.is_active = true
             ORDER BY h.name`
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createHouse = async (req, res) => {
    const { name, color, school_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO pm_houses (name, color, school_id) VALUES ($1,$2,$3) RETURNING *`,
            [name, color || null, school_id || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateHouse = async (req, res) => {
    const { id } = req.params;
    const { name, color, school_id, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE pm_houses SET name=$1, color=$2, school_id=$3, is_active=$4 WHERE id=$5 RETURNING *`,
            [name, color, school_id || null, is_active ?? true, id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ SLEEVE TYPES ════════════════════════════════ */
exports.getSleeveTypes = async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM pm_sleeve_types WHERE is_active = true ORDER BY name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createSleeveType = async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(`INSERT INTO pm_sleeve_types (name) VALUES ($1) RETURNING *`, [name]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ FABRIC TYPES ════════════════════════════════ */
exports.getFabricTypes = async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM pm_fabric_types WHERE is_active = true ORDER BY name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createFabricType = async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO pm_fabric_types (name, description) VALUES ($1,$2) RETURNING *`,
            [name, description || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateFabricType = async (req, res) => {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE pm_fabric_types SET name=$1, description=$2, is_active=$3 WHERE id=$4 RETURNING *`,
            [name, description, is_active ?? true, id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ SIZES ════════════════════════════════════════ */
exports.getSizes = async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM pm_sizes WHERE is_active = true ORDER BY sort_order, name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createSize = async (req, res) => {
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO pm_sizes (name, sort_order) VALUES ($1,$2) RETURNING *`,
            [name, sort_order ?? 0]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateSize = async (req, res) => {
    const { id } = req.params;
    const { name, sort_order, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE pm_sizes SET name=$1, sort_order=$2, is_active=$3 WHERE id=$4 RETURNING *`,
            [name, sort_order ?? 0, is_active ?? true, id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ SKU / BARCODE GENERATION ═════════════════════ */
exports.generateSKU = async (req, res) => {
    try {
        const { category_id, gender_id, size, color_id, product_id } = req.query;

        let categoryName = '', genderName = '', colorName = '';

        if (category_id) {
            const r = await db.query(`SELECT name FROM inv_categories WHERE id=$1`, [category_id]);
            categoryName = r.rows[0]?.name || '';
        }
        if (gender_id) {
            const r = await db.query(`SELECT name FROM pm_genders WHERE id=$1`, [gender_id]);
            genderName = r.rows[0]?.name || '';
        }
        if (color_id) {
            const r = await db.query(`SELECT name FROM pm_colors WHERE id=$1`, [color_id]);
            colorName = r.rows[0]?.name || '';
        }

        // Get next seq for this product
        const seqRes = await db.query(
            `SELECT COUNT(*)+1 AS seq FROM inv_variants WHERE product_id=$1`,
            [product_id || 0]
        );
        const seq = parseInt(seqRes.rows[0].seq || 1);

        const sku = generateSKU({ category: categoryName, gender: genderName, size, color: colorName, seq });
        res.json({ sku });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.generateBarcode = async (req, res) => {
    try {
        const { product_id } = req.query;
        if (!product_id) return res.status(400).json({ error: 'product_id required' });

        const seqRes = await db.query(
            `SELECT COUNT(*)+1 AS seq FROM inv_variants WHERE product_id=$1`,
            [product_id]
        );
        const seq = parseInt(seqRes.rows[0].seq || 1);
        const barcode = generateBarcode(parseInt(product_id), seq);
        res.json({ barcode });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ ALL LOOKUPS IN ONE CALL ══════════════════════ */
exports.getLookups = async (req, res) => {
    try {
        const [colors, genders, houses, sleeves, fabrics, sizes] = await Promise.all([
            db.query(`SELECT * FROM pm_colors     WHERE is_active=true ORDER BY name`),
            db.query(`SELECT * FROM pm_genders    WHERE is_active=true ORDER BY name`),
            db.query(`SELECT h.*, s.name AS school_name FROM pm_houses h LEFT JOIN inv_schools s ON s.id=h.school_id WHERE h.is_active=true ORDER BY h.name`),
            db.query(`SELECT * FROM pm_sleeve_types WHERE is_active=true ORDER BY name`),
            db.query(`SELECT * FROM pm_fabric_types WHERE is_active=true ORDER BY name`),
            db.query(`SELECT * FROM pm_sizes        WHERE is_active=true ORDER BY sort_order, name`),
        ]);
        res.json({
            colors:       colors.rows,
            genders:      genders.rows,
            houses:       houses.rows,
            sleeve_types: sleeves.rows,
            fabric_types: fabrics.rows,
            sizes:        sizes.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
