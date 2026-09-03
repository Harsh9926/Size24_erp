// erp-system/backend/services/faceVerificationService.js
// Self-hosted face verification for attendance punch-in (face-api.js + node-canvas).
//
// Compares the live punch-in selfie against the employee's approved registration
// selfie. Fails CLOSED on every ambiguous case (no face detected, model not
// ready, corrupt image) — a punch-in must never be marked present without a
// confirmed face match.
//
// Model weights live in backend/models/ (tiny_face_detector, face_landmark_68,
// face_recognition) — see backend/models/README.md for provenance.

const path = require('path');

// face-api.js / canvas are native/optional dependencies for this feature only.
// If they aren't installed (e.g. a deploy ran `pm2 restart` without `npm install`
// after this feature was added), face verification must fail closed — it must
// NOT take down the rest of the API (login, permissions, etc.) by throwing here.
let faceapi = null;
let loadError = null;
try {
    faceapi = require('face-api.js');
    const { Canvas, Image, ImageData } = require('canvas');
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
} catch (err) {
    loadError = err;
    console.error('[faceVerification] face-api.js/canvas unavailable — face verification disabled:', err.message);
}

const MODELS_DIR = path.join(__dirname, '..', 'models');

// Lower = stricter. 0.6 is face-api.js's own documented default match threshold
// for its FaceRecognitionNet descriptors (Euclidean distance on 128-d vectors).
const DEFAULT_THRESHOLD = 0.55;

let loadPromise = null;
function ensureModelsLoaded() {
    if (loadError) return Promise.reject(loadError);
    if (!loadPromise) {
        loadPromise = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_DIR),
            faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR),
            faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR),
        ]).then(() => {
            console.log('[faceVerification] Models loaded from', MODELS_DIR);
        }).catch((err) => {
            loadPromise = null; // allow retry on next call
            throw err;
        });
    }
    return loadPromise;
}

/**
 * Extract a 128-d face descriptor from an image buffer.
 * Returns null if no single face could be confidently detected (fail-closed
 * upstream — callers must treat null as "cannot verify", not "skip check").
 */
async function getFaceDescriptor(buffer) {
    if (!buffer || !buffer.length) return null;
    await ensureModelsLoaded();
    const { loadImage } = require('canvas');
    const image = await loadImage(buffer);
    const result = await faceapi
        .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
    if (!result) return null;
    return Array.from(result.descriptor); // plain array — JSON/DB friendly
}

function euclideanDistance(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
}

/**
 * Verify a live selfie against a known-good reference descriptor.
 * @param {Buffer} liveBuffer        raw bytes of the live punch-in selfie
 * @param {number[]} referenceDescriptor  the registered employee's cached face descriptor
 * @param {number} threshold         max Euclidean distance to count as a match
 * @returns {{matched:boolean, distance:number|null, reason?:string}}
 */
async function verifyAgainstDescriptor(liveBuffer, referenceDescriptor, threshold = DEFAULT_THRESHOLD) {
    if (!Array.isArray(referenceDescriptor) || referenceDescriptor.length === 0) {
        return { matched: false, distance: null, reason: 'no_reference' };
    }
    let liveDescriptor;
    try {
        liveDescriptor = await getFaceDescriptor(liveBuffer);
    } catch (err) {
        console.error('[faceVerification] descriptor extraction failed:', err.message);
        return { matched: false, distance: null, reason: 'extraction_failed' };
    }
    if (!liveDescriptor) return { matched: false, distance: null, reason: 'no_face_detected' };

    const distance = euclideanDistance(liveDescriptor, referenceDescriptor);
    return { matched: distance <= threshold, distance: Number(distance.toFixed(4)) };
}

module.exports = {
    DEFAULT_THRESHOLD,
    ensureModelsLoaded,
    getFaceDescriptor,
    verifyAgainstDescriptor,
};
