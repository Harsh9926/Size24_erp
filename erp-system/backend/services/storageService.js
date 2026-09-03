// erp-system/backend/services/storageService.js
// Private AWS S3 storage for attendance selfies with presigned-URL viewing.
//
// Design:
//   • Uploads go straight to a PRIVATE S3 bucket (no public ACL). Backend only.
//   • Only the S3 OBJECT KEY is returned/stored in Postgres (never binary, never a
//     public URL). Local-disk fallback stores a "/uploads/..." path instead.
//   • To view an image, the backend generates a short-lived presigned GET URL.
//   • AWS credentials come exclusively from environment variables.
//
// Required env (backend/.env):
//   AWS_S3_BUCKET=attendance-image
//   AWS_REGION=ap-south-1
//   AWS_ACCESS_KEY_ID=...
//   AWS_SECRET_ACCESS_KEY=...
// Optional:
//   S3_PRESIGN_EXPIRY_SECONDS=900   (default 15 min)

const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

const S3_ENABLED = !!(
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
);

let S3Client, PutObjectCommand, GetObjectCommand, getSignedUrl, s3 = null;
if (S3_ENABLED) {
    try {
        ({ S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'));
        ({ getSignedUrl } = require('@aws-sdk/s3-request-presigner'));
        s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        console.log(`[storage] AWS S3 (private) enabled: ${process.env.AWS_S3_BUCKET} @ ${process.env.AWS_REGION}`);
    } catch (err) {
        console.error('[storage] AWS SDK v3 not available — falling back to local disk:', err.message);
        s3 = null;
    }
}

const PRESIGN_EXPIRY = Number(process.env.S3_PRESIGN_EXPIRY_SECONDS || 900);

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function extFor(file) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    return /^\.(jpe?g|png|webp)$/.test(ext) ? ext : '.jpg';
}

// Map a punch/registration context to a file-name prefix.
const CONTEXT_PREFIX = {
    punch_in: 'punch-in',
    punch_out: 'punch-out',
    registration: 'registration',
    location_change: 'location-change',
    daily_entry: 'photo-proof',
};

/**
 * Build the S3 object key with the required structure:
 *   YYYY/MM/DD/user_{userId}/{context}_{timestamp}.jpg
 */
function buildKey({ userId, context, ext }) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = CONTEXT_PREFIX[context] || 'selfie';
    const ts = now.getTime();
    const rand = crypto.randomBytes(3).toString('hex');
    return `${yyyy}/${mm}/${dd}/user_${userId}/${prefix}_${ts}-${rand}${ext}`;
}

/**
 * Upload an image buffer. Returns the STORAGE REFERENCE to persist in Postgres:
 *   • S3 mode   → the S3 object key (e.g. "2026/08/08/user_24/punch-in_...jpg")
 *   • local mode→ a "/uploads/..." path
 * @param {object} file    multer memoryStorage file ({ buffer, originalname, mimetype })
 * @param {object} opts    { userId, context }  context ∈ punch_in|punch_out|registration|location_change
 */
async function uploadImage(file, opts = {}) {
    if (!file || !file.buffer) throw new Error('No file provided');
    const ext = extFor(file);
    const userId = opts.userId || 'unknown';
    const context = opts.context || 'selfie';

    if (s3) {
        const key = buildKey({ userId, context, ext });
        await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || 'image/jpeg',
            // No ACL — bucket stays private.
        }));
        return key; // store ONLY the key
    }

    // Local-disk fallback (dev / no S3 configured)
    const folder = `attendance/${CONTEXT_PREFIX[context] || 'selfie'}`;
    const diskDir = path.join(uploadsDir, folder);
    if (!fs.existsSync(diskDir)) fs.mkdirSync(diskDir, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(diskDir, name), file.buffer);
    return `/uploads/${folder}/${name}`;
}

// A stored reference is an S3 key when it does NOT start with "/uploads" and is not absolute.
const isS3Key = (ref) => !!ref && !ref.startsWith('/uploads') && !/^https?:\/\//.test(ref);

/**
 * Resolve a stored reference to a viewable URL.
 *   • S3 key  → short-lived presigned GET URL
 *   • local   → the "/uploads/..." path unchanged (frontend prepends backend origin)
 * Returns null for empty input.
 */
async function getViewUrl(ref) {
    if (!ref) return null;
    if (s3 && isS3Key(ref)) {
        try {
            return await getSignedUrl(
                s3,
                new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: ref }),
                { expiresIn: PRESIGN_EXPIRY }
            );
        } catch (err) {
            console.error('[storage] presign failed for', ref, err.message);
            return null;
        }
    }
    return ref; // local path or already-absolute URL
}

/**
 * Fetch the raw bytes of a stored image reference (S3 key or local "/uploads/..." path).
 * Used server-side for face verification — never exposed to the frontend.
 * Returns null if the reference is empty or cannot be read.
 */
async function getImageBuffer(ref) {
    if (!ref) return null;
    try {
        if (s3 && isS3Key(ref)) {
            const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: ref }));
            const chunks = [];
            for await (const chunk of obj.Body) chunks.push(chunk);
            return Buffer.concat(chunks);
        }
        const localPath = ref.startsWith('/uploads')
            ? path.join(__dirname, '..', ref)
            : path.join(uploadsDir, ref);
        return fs.readFileSync(localPath);
    } catch (err) {
        console.error('[storage] getImageBuffer failed for', ref, err.message);
        return null;
    }
}

/**
 * Replace selfie-reference fields on a row (or array of rows) with presigned view URLs.
 * @param {object|object[]} data
 * @param {string[]} fields  column names holding selfie references
 */
async function signSelfieFields(data, fields) {
    const rows = Array.isArray(data) ? data : [data];
    await Promise.all(rows.map(async (row) => {
        if (!row) return;
        await Promise.all(fields.map(async (f) => {
            if (row[f]) row[f] = await getViewUrl(row[f]);
        }));
    }));
    return data;
}

module.exports = {
    uploadImage,
    getViewUrl,
    getImageBuffer,
    signSelfieFields,
    S3_ENABLED: !!s3,
};
