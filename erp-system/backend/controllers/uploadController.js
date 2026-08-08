const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadImage } = require('../services/storageService');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only image files (jpg, png, webp) are allowed'));
};

exports.upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

exports.uploadFile = (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, message: 'File uploaded successfully' });
};

// ── Daily-Entry Photo Proof → private S3 (memory storage) ────────────
// Reuses the shared storageService. Returns ONLY the S3 object key.
exports.uploadMem = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\//.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    },
});

exports.uploadPhotoProof = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });
        const key = await uploadImage(req.file, { userId: req.user.id, context: 'daily_entry' });
        res.json({ key, message: 'Photo uploaded successfully' });
    } catch (err) {
        console.error('[uploadPhotoProof] S3 upload failed:', err.message);
        res.status(502).json({ error: 'Photo upload to storage failed. Please retry.' });
    }
};
