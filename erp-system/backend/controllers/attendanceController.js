// erp-system/backend/controllers/attendanceController.js
// Employee Attendance Management Module.
// Roles: 'shop_user' = Employee, 'manager', 'admin'.

const db = require('../config/db');
const { uploadImage, signSelfieFields, getImageBuffer } = require('../services/storageService');
const { getFaceDescriptor, verifyAgainstDescriptor, DEFAULT_THRESHOLD } = require('../services/faceVerificationService');
const { Parser: Json2csvParser } = require('json2csv');
const XLSX = require('xlsx');
const wa = require('../services/aiSensyService');

/* "HH:MM AM/PM" in IST, for WhatsApp admin punch alerts */
const fmtTimeIST = (d) =>
    new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

/* Fire-and-forget: notify all active admins on WhatsApp. Never throws —
 * attendance must stay saved even if AiSensy is down or misconfigured. */
async function notifyAdminsPunch(templateFn, uid, ...args) {
    if (!wa.ENABLED) return;
    try {
        const { rows: admins } = await db.query(
            `SELECT mobile FROM users WHERE role = 'admin' AND mobile IS NOT NULL AND status = 'active'`
        );
        const { rows: nameRows } = await db.query('SELECT name FROM users WHERE id = $1', [uid]);
        const employeeName = nameRows[0]?.name || 'Employee';
        for (const a of admins) {
            await templateFn(a.mobile, employeeName, ...args);
        }
    } catch (err) {
        console.error('[attendance] Admin WhatsApp punch notify failed:', err.message);
    }
}

/* ── Geo: haversine distance in metres ──────────────────────────── */
const toRad = (v) => (v * Math.PI) / 180;
function distanceM(lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some((v) => v == null || isNaN(v))) return null;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Time helpers ───────────────────────────────────────────────── */
const todayISO = () => new Date().toISOString().split('T')[0];
// Minutes since midnight for a Date (local server time — assumed IST deploy)
const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();
// "HH:MM[:SS]" -> minutes since midnight
const timeToMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
};

/* ── Attendance status from punch-in time ───────────────────────── */
function punchInStatus(now, s) {
    const t = minutesOfDay(now);
    const start = timeToMin(s.shift_start);
    const grace = start + (s.grace_minutes || 0);
    const half  = timeToMin(s.half_day_after);
    if (t < start) return 'early_arrival';
    if (t <= grace) return 'on_time';
    if (t <= half)  return 'late';
    return 'half_day';
}
function punchOutStatus(now, s) {
    const t = minutesOfDay(now);
    const end = timeToMin(s.shift_end);
    if (t < end) return 'early_exit';
    if (t <= end + 15) return 'on_time';
    return 'overtime';
}
// Overall day status for reporting
function overallStatus(inStatus) {
    if (inStatus === 'half_day') return 'half_day';
    if (inStatus === 'late') return 'late';
    return 'present';
}

/* ── UA parser (lightweight, no dependency) ─────────────────────── */
function parseUA(ua = '') {
    let browser = 'Unknown';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';
    let device = 'Desktop';
    if (/android/i.test(ua)) device = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) device = 'iOS';
    else if (/windows/i.test(ua)) device = 'Windows';
    else if (/mac os/i.test(ua)) device = 'macOS';
    else if (/linux/i.test(ua)) device = 'Linux';
    return { browser, device };
}
const clientIp = (req) =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress || req.ip || '';

async function getSettings() {
    let { rows } = await db.query('SELECT * FROM attendance_settings WHERE id = 1');
    if (!rows.length) {
        // Self-heal: create the single settings row from schema defaults
        // (office_radius_m defaults to 50m — the required geofence).
        await db.query('INSERT INTO attendance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
        ({ rows } = await db.query('SELECT * FROM attendance_settings WHERE id = 1'));
    }
    return rows[0] || null;
}

// Effective settings for a user = global attendance_settings with any
// per-user overrides applied (NULL override => inherit global).
async function getEffectiveSettings(userId) {
    const g = await getSettings();
    let u = {};
    try {
        u = (await db.query('SELECT * FROM attendance_user_settings WHERE user_id=$1', [userId])).rows[0] || {};
    } catch (e) { /* table may not exist yet on first boot */ }
    const pick = (k) => (u[k] === null || u[k] === undefined) ? g[k] : u[k];
    return {
        ...g,
        shift_start:        pick('shift_start'),
        shift_end:          pick('shift_end'),
        grace_minutes:      pick('grace_minutes'),
        half_day_after:     pick('half_day_after'),
        min_working_hours:  pick('min_working_hours'),
        require_gps:        pick('require_gps'),
        require_selfie:     pick('require_selfie'),
        max_gps_accuracy_m: pick('max_gps_accuracy_m'),
        week_off_days:      (u.week_off_days == null ? g.week_off_days : u.week_off_days),
        office_radius_m:    pick('office_radius_m'),
        enforce_shop_location: (u.enforce_shop_location == null ? false : u.enforce_shop_location),
        monthly_salary:     (u.monthly_salary == null ? null : u.monthly_salary),
        _has_override:      Object.keys(u).length > 0,
    };
}

async function getAssignedShopsWithGeofence(userId) {
    // 1. Check dedicated attendance_shop_users table
    const attShops = await db.query(
        `SELECT DISTINCT s.id, s.shop_name, s.latitude, s.longitude,
                COALESCE(s.geofence_radius_m, 50) AS geofence_radius_m
         FROM attendance_shop_users asu
         JOIN shops s ON s.id = asu.shop_id
         WHERE asu.user_id = $1
         ORDER BY s.shop_name ASC`,
        [userId]
    );
    if (attShops.rows.length > 0) {
        return attShops.rows;
    }
    // 2. Fallback to general shop_users / shops.user_id for backward compatibility
    const { rows } = await db.query(
        `SELECT DISTINCT s.id, s.shop_name, s.latitude, s.longitude,
                COALESCE(s.geofence_radius_m, 50) AS geofence_radius_m
         FROM shops s
         LEFT JOIN shop_users su ON su.shop_id = s.id
         WHERE (su.user_id = $1 OR s.user_id = $1)
         ORDER BY s.shop_name ASC`,
        [userId]
    );
    return rows;
}

// Resolve the primary geofence for reference
async function resolveOffice(userId, reg, eff) {
    const assignedShops = await getAssignedShopsWithGeofence(userId);
    const valid = assignedShops.find(s => s.latitude != null && s.longitude != null);
    if (valid) {
        return { lat: Number(valid.latitude), lng: Number(valid.longitude), radius: Number(valid.geofence_radius_m) || eff.office_radius_m, source: 'shop', shop_id: valid.id };
    }
    return {
        lat: reg?.registered_lat, lng: reg?.registered_lng,
        radius: reg?.allowed_radius_m || eff.office_radius_m, source: 'registration',
    };
}

async function logAction(userId, attendanceId, action, detail, req) {
    try {
        await db.query(
            `INSERT INTO attendance_logs (user_id, attendance_id, action, detail, ip)
             VALUES ($1,$2,$3,$4,$5)`,
            [userId, attendanceId, action, detail ? JSON.stringify(detail) : null, clientIp(req)]
        );
    } catch (e) { /* non-fatal */ }
}

// Resolve a user's primary shop (registration shop, else first assigned shop)
async function resolveShopId(userId) {
    const reg = await db.query('SELECT shop_id FROM attendance_registration WHERE user_id = $1', [userId]);
    if (reg.rows[0]?.shop_id) return reg.rows[0].shop_id;
    const su = await db.query(
        'SELECT shop_id FROM shop_users WHERE user_id = $1 ORDER BY assigned_at ASC LIMIT 1', [userId]
    );
    return su.rows[0]?.shop_id || null;
}

const emitRealtime = (req, event, payload) => {
    try { req.app.get('io')?.emit(event, payload); } catch (e) {}
};

// Resolve (computing + caching if needed) the face descriptor for an
// employee's APPROVED registration selfie. Returns null if unavailable for
// any reason — callers must treat null as "cannot verify" (fail closed),
// never as "skip the check".
async function getRegisteredFaceDescriptor(reg) {
    if (!reg || reg.status !== 'approved' || !reg.selfie_url) return null;
    if (Array.isArray(reg.face_descriptor) && reg.face_descriptor.length) return reg.face_descriptor;
    try {
        const buf = await getImageBuffer(reg.selfie_url);
        const descriptor = await getFaceDescriptor(buf);
        if (!descriptor) return null;
        await db.query(
            `UPDATE attendance_registration SET face_descriptor=$1, face_descriptor_updated_at=CURRENT_TIMESTAMP WHERE id=$2`,
            [JSON.stringify(descriptor), reg.id]
        );
        return descriptor;
    } catch (err) {
        console.error('[attendance.getRegisteredFaceDescriptor]', err.message);
        return null;
    }
}

/* ══════════════════════════════════════════════════════════════════
   SELF / EMPLOYEE + MANAGER ENDPOINTS
══════════════════════════════════════════════════════════════════ */

// GET /api/attendance/me — today's status + registration + settings
exports.getMyStatus = async (req, res) => {
    try {
        const uid = req.user.id;
        const [settings, regRes, todayRes] = await Promise.all([
            getEffectiveSettings(uid),
            db.query('SELECT * FROM attendance_registration WHERE user_id = $1', [uid]),
            db.query('SELECT * FROM attendance WHERE user_id = $1 AND date = $2', [uid, todayISO()]),
        ]);
        const registration = regRes.rows[0] || null;
        const today = todayRes.rows[0] || null;
        await signSelfieFields(registration, ['selfie_url']);
        await signSelfieFields(today, ['punch_in_selfie_url', 'punch_out_selfie_url']);
        if (today) {
            const sessions = await sessionsFor(today.id);
            await signSelfieFields(sessions, ['punch_in_selfie_url', 'punch_out_selfie_url']);
            today.sessions = sessions;
            today.has_open_session = sessions.some((s) => !s.punch_out_at);
        }
        res.json({ settings, registration, today });
    } catch (err) {
        console.error('[attendance.getMyStatus]', err.message);
        res.status(500).json({ error: 'Failed to load attendance status' });
    }
};

// POST /api/attendance/register  (multipart: selfie + lat/lng/accuracy)
exports.register = async (req, res) => {
    try {
        const uid = req.user.id;
        const { latitude, longitude, gps_accuracy } = req.body;
        const settings = await getSettings();

        if (settings.require_gps && (!latitude || !longitude))
            return res.status(400).json({ error: 'GPS location is required to register.' });
        if (settings.require_selfie && !req.file)
            return res.status(400).json({ error: 'A selfie is required to register.' });

        let selfieUrl = null;
        if (req.file) selfieUrl = await uploadImage(req.file, { userId: uid, context: 'registration' });

        const shopId = await resolveShopId(uid);

        const { rows } = await db.query(
            `INSERT INTO attendance_registration
               (user_id, shop_id, latitude, longitude, gps_accuracy_m, selfie_url, status)
             VALUES ($1,$2,$3,$4,$5,$6,'pending')
             ON CONFLICT (user_id) DO UPDATE SET
               shop_id=$2, latitude=$3, longitude=$4, gps_accuracy_m=$5,
               selfie_url=$6, status='pending', reject_reason=NULL,
               reviewed_by=NULL, reviewed_at=NULL, created_at=CURRENT_TIMESTAMP,
               face_descriptor=NULL, face_descriptor_updated_at=NULL
             RETURNING *`,
            [uid, shopId, latitude || null, longitude || null, gps_accuracy || null, selfieUrl]
        );
        if (selfieUrl) {
            await db.query(
                `INSERT INTO attendance_selfies (user_id, context, url, latitude, longitude)
                 VALUES ($1,'registration',$2,$3,$4)`,
                [uid, selfieUrl, latitude || null, longitude || null]
            );
        }
        await logAction(uid, null, 'REGISTER', { shopId }, req);
        emitRealtime(req, 'attendance:registration', { userId: uid });
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[attendance.register]', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// Shared validation for a punch against all assigned shops.
// Returns { ok, error, distance, matchedShop }
async function validatePunch(reg, settings, body, hasFile, userId) {
    if (!reg || reg.status !== 'approved')
        return { error: 'Your registration is not approved yet. Please contact admin.' };

    const { latitude, longitude, gps_accuracy } = body;
    if (settings.require_gps && (!latitude || !longitude))
        return { error: 'GPS location is required.' };
    if (settings.require_selfie && !hasFile)
        return { error: 'A selfie is required.' };
    if (settings.require_gps && gps_accuracy != null &&
        Number(gps_accuracy) > settings.max_gps_accuracy_m)
        return { error: `GPS accuracy too low (${Math.round(gps_accuracy)}m). Must be within ${settings.max_gps_accuracy_m}m. Move to an open area and retry.` };

    if (!settings.require_gps) {
        const assignedShops = await getAssignedShopsWithGeofence(userId);
        return { ok: true, matchedShop: assignedShops[0] || null, distance: 0 };
    }

    const assignedShops = await getAssignedShopsWithGeofence(userId);
    const validGeofenceShops = assignedShops.filter(s => s.latitude != null && s.longitude != null);

    if (validGeofenceShops.length === 0) {
        return {
            error: 'You are outside your assigned shop location.',
            distance: null
        };
    }

    let matchedShop = null;
    let minDistance = Infinity;

    for (const shop of validGeofenceShops) {
        const dist = distanceM(
            Number(latitude), Number(longitude),
            Number(shop.latitude), Number(shop.longitude)
        );
        if (dist != null) {
            if (dist < minDistance) {
                minDistance = dist;
            }
            const radius = Number(shop.geofence_radius_m) || Number(settings.office_radius_m) || 50;
            if (dist <= radius) {
                matchedShop = shop;
                minDistance = dist;
                break;
            }
        }
    }

    if (!matchedShop) {
        return {
            error: 'You are outside your assigned shop location.',
            distance: minDistance === Infinity ? null : minDistance
        };
    }

    return { ok: true, matchedShop, distance: minDistance };
}

// Fetch all sessions for an attendance row (ordered), used by status + UI.
async function sessionsFor(attendanceId) {
    if (!attendanceId) return [];
    const { rows } = await db.query(
        'SELECT * FROM attendance_sessions WHERE attendance_id=$1 ORDER BY seq', [attendanceId]
    );
    return rows;
}

// POST /api/attendance/punch-in — supports multiple In→Out→In→Out sessions.
exports.punchIn = async (req, res) => {
    try {
        const uid = req.user.id;
        const settings = await getEffectiveSettings(uid);
        const reg = (await db.query('SELECT * FROM attendance_registration WHERE user_id=$1', [uid])).rows[0];

        let existing = (await db.query(
            'SELECT * FROM attendance WHERE user_id=$1 AND date=$2', [uid, todayISO()]
        )).rows[0];

        // Block a second punch-in while a session is still open.
        if (existing) {
            const open = (await db.query(
                'SELECT id FROM attendance_sessions WHERE attendance_id=$1 AND punch_out_at IS NULL LIMIT 1',
                [existing.id]
            )).rows[0];
            if (open)
                return res.status(409).json({ error: 'You have an open session. Please punch out first.' });
        }

        const v = await validatePunch(reg, settings, req.body, !!req.file, uid);
        if (v.error) return res.status(400).json({ error: v.error, distance: v.distance });

        // Face verification — mandatory for every self-punch-in, independent of
        // the require_selfie GPS/photo toggle above. Runs AFTER the geofence
        // check but BEFORE any attendance/session row is created or the selfie
        // is persisted to storage: a failed match must leave zero trace of a
        // punch. Fails closed on every ambiguous outcome (no file, no face
        // detected, model error) — never silently skipped for a normal employee.
        if (!req.file) {
            return res.status(400).json({ error: 'A live selfie is required for face verification.' });
        }
        const referenceDescriptor = await getRegisteredFaceDescriptor(reg);
        if (!referenceDescriptor) {
            return res.status(400).json({ error: 'No approved reference photo on file. Please contact admin to complete registration.' });
        }
        const threshold = Number(settings.face_match_threshold ?? DEFAULT_THRESHOLD);
        const faceCheck = await verifyAgainstDescriptor(req.file.buffer, referenceDescriptor, threshold);
        if (!faceCheck.matched) {
            await logAction(uid, existing?.id || null, 'PUNCH_IN_FACE_FAIL', { distance: faceCheck.distance, reason: faceCheck.reason }, req);
            return res.status(400).json({
                error: faceCheck.reason === 'no_face_detected'
                    ? 'No face detected in the selfie. Please retry in good lighting, facing the camera directly.'
                    : 'Face verification failed. Attendance cannot be marked.',
                distance: faceCheck.distance,
            });
        }

        let selfieUrl = null;
        if (req.file) selfieUrl = await uploadImage(req.file, { userId: uid, context: 'punch_in' });

        const now = new Date();
        const inStatus = punchInStatus(now, settings);
        const { browser, device } = parseUA(req.headers['user-agent']);
        const shopId = v.matchedShop?.id || await resolveShopId(uid);

        // Create the parent day row on the first punch, or reuse it for a new session.
        if (!existing) {
            existing = (await db.query(
                `INSERT INTO attendance
                   (user_id, shop_id, date, punch_in_at, punch_in_lat, punch_in_lng,
                    punch_in_distance_m, punch_in_accuracy_m, punch_in_selfie_url,
                    punch_in_status, punch_in_ip, punch_in_browser, punch_in_device,
                    attendance_status, status_source, punch_in_face_verified, punch_in_face_distance)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'punch',$15,$16)
                 RETURNING *`,
                [uid, shopId, todayISO(), now, req.body.latitude, req.body.longitude,
                 v.distance, req.body.gps_accuracy || null, selfieUrl, inStatus,
                 clientIp(req), browser, device, overallStatus(inStatus),
                 faceCheck.matched, faceCheck.distance]
            )).rows[0];
        } else {
            // New session opening on an existing day: clear the parent punch-out
            // so "currently working / online" (punch_in set, punch_out null) is
            // accurate again. Session rows preserve the full punch history.
            await db.query(
                `UPDATE attendance SET punch_out_at=NULL, punch_out_status=NULL,
                   shop_id=COALESCE($2, shop_id), punch_in_face_verified=$3, punch_in_face_distance=$4,
                   updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
                [existing.id, shopId, faceCheck.matched, faceCheck.distance]
            );
        }

        const seq = (await db.query(
            'SELECT COALESCE(MAX(seq),0)+1 AS n FROM attendance_sessions WHERE attendance_id=$1', [existing.id]
        )).rows[0].n;

        let sess;
        try {
            sess = (await db.query(
                `INSERT INTO attendance_sessions
                   (attendance_id, user_id, date, seq, punch_in_at, punch_in_lat, punch_in_lng,
                    punch_in_distance_m, punch_in_accuracy_m, punch_in_selfie_url,
                    punch_in_status, punch_in_ip, punch_in_browser, punch_in_device,
                    punch_in_face_verified, punch_in_face_distance)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
                [existing.id, uid, todayISO(), seq, now, req.body.latitude, req.body.longitude,
                 v.distance, req.body.gps_accuracy || null, selfieUrl, inStatus,
                 clientIp(req), browser, device, faceCheck.matched, faceCheck.distance]
            )).rows[0];
        } catch (err) {
            // 23505 = unique_violation on uq_att_sessions_open: a concurrent
            // request already opened a session for this attendance_id first.
            // Lose the race cleanly instead of creating a duplicate session
            // (and a duplicate admin WhatsApp alert).
            if (err.code === '23505')
                return res.status(409).json({ error: 'You have an open session. Please punch out first.' });
            throw err;
        }

        if (selfieUrl) {
            await db.query(
                `INSERT INTO attendance_selfies (user_id, attendance_id, context, url, latitude, longitude)
                 VALUES ($1,$2,'punch_in',$3,$4,$5)`,
                [uid, existing.id, selfieUrl, req.body.latitude, req.body.longitude]
            );
        }
        await logAction(uid, existing.id, 'PUNCH_IN', { inStatus, seq, distance: v.distance, shopId, faceDistance: faceCheck.distance }, req);
        emitRealtime(req, 'attendance:update', { userId: uid, date: todayISO() });
        const fresh = (await db.query('SELECT * FROM attendance WHERE id=$1', [existing.id])).rows[0];
        res.status(201).json({ ...fresh, sessions: await sessionsFor(existing.id), session: sess });

        // Admin WhatsApp alert — fired after the response so it can never delay
        // or fail the punch-in itself; errors are caught and logged internally.
        notifyAdminsPunch(wa.notifyEmployeePunchIn, uid, fmtTimeIST(now));
    } catch (err) {
        console.error('[attendance.punchIn]', err.message);
        res.status(500).json({ error: 'Punch in failed' });
    }
};

// POST /api/attendance/punch-out — closes the latest open session.
exports.punchOut = async (req, res) => {
    try {
        const uid = req.user.id;
        const settings = await getEffectiveSettings(uid);
        const reg = (await db.query('SELECT * FROM attendance_registration WHERE user_id=$1', [uid])).rows[0];

        const existing = (await db.query(
            'SELECT * FROM attendance WHERE user_id=$1 AND date=$2', [uid, todayISO()]
        )).rows[0];
        if (!existing?.punch_in_at)
            return res.status(400).json({ error: 'You must punch in before punching out.' });

        const openSess = (await db.query(
            `SELECT * FROM attendance_sessions WHERE attendance_id=$1 AND punch_out_at IS NULL
             ORDER BY seq DESC LIMIT 1`, [existing.id]
        )).rows[0];
        if (!openSess)
            return res.status(409).json({ error: 'No open session to punch out. Please punch in first.' });

        const v = await validatePunch(reg, settings, req.body, !!req.file, uid);
        if (v.error) return res.status(400).json({ error: v.error, distance: v.distance });

        // Face verification — mandatory for every self-punch-out, same as
        // punch-in: a punch-out selfie of someone other than the registered
        // employee must never close a session. Fails closed on every
        // ambiguous outcome, before the session/selfie is persisted.
        if (!req.file) {
            return res.status(400).json({ error: 'A live selfie is required for face verification.' });
        }
        const referenceDescriptor = await getRegisteredFaceDescriptor(reg);
        if (!referenceDescriptor) {
            return res.status(400).json({ error: 'No approved reference photo on file. Please contact admin to complete registration.' });
        }
        const threshold = Number(settings.face_match_threshold ?? DEFAULT_THRESHOLD);
        const faceCheck = await verifyAgainstDescriptor(req.file.buffer, referenceDescriptor, threshold);
        if (!faceCheck.matched) {
            await logAction(uid, existing.id, 'PUNCH_OUT_FACE_FAIL', { distance: faceCheck.distance, reason: faceCheck.reason }, req);
            return res.status(400).json({
                error: faceCheck.reason === 'no_face_detected'
                    ? 'No face detected in the selfie. Please retry in good lighting, facing the camera directly.'
                    : 'Face verification failed. Attendance cannot be marked.',
                distance: faceCheck.distance,
            });
        }

        let selfieUrl = null;
        if (req.file) selfieUrl = await uploadImage(req.file, { userId: uid, context: 'punch_out' });

        const now = new Date();
        const outStatus = punchOutStatus(now, settings);
        const { browser, device } = parseUA(req.headers['user-agent']);
        const sessHours = Math.max(0, (now - new Date(openSess.punch_in_at)) / 3_600_000).toFixed(2);

        // Close the open session — guarded by "punch_out_at IS NULL" so a
        // concurrent duplicate punch-out request can't silently re-close an
        // already-closed session and trigger a second admin WhatsApp alert.
        const closeRes = await db.query(
            `UPDATE attendance_sessions SET
               punch_out_at=$1, punch_out_lat=$2, punch_out_lng=$3, punch_out_distance_m=$4,
               punch_out_accuracy_m=$5, punch_out_selfie_url=$6, punch_out_status=$7,
               punch_out_ip=$8, punch_out_browser=$9, working_hours=$10, updated_at=CURRENT_TIMESTAMP,
               punch_out_face_verified=$12, punch_out_face_distance=$13
             WHERE id=$11 AND punch_out_at IS NULL RETURNING id`,
            [now, req.body.latitude, req.body.longitude, v.distance,
             req.body.gps_accuracy || null, selfieUrl, outStatus,
             clientIp(req), browser, sessHours, openSess.id,
             faceCheck.matched, faceCheck.distance]
        );
        if (closeRes.rowCount === 0)
            return res.status(409).json({ error: 'No open session to punch out. Please punch in first.' });

        // Recompute the day total from ALL sessions (never overwrites past punches).
        const totalHours = (await db.query(
            'SELECT COALESCE(SUM(working_hours),0) AS t FROM attendance_sessions WHERE attendance_id=$1', [existing.id]
        )).rows[0].t;

        const { rows } = await db.query(
            `UPDATE attendance SET
               punch_out_at=$1, punch_out_lat=$2, punch_out_lng=$3, punch_out_distance_m=$4,
               punch_out_accuracy_m=$5, punch_out_selfie_url=$6, punch_out_status=$7,
               punch_out_ip=$8, punch_out_browser=$9, working_hours=$10,
               updated_at=CURRENT_TIMESTAMP,
               punch_out_face_verified=$12, punch_out_face_distance=$13
             WHERE id=$11 RETURNING *`,
            [now, req.body.latitude, req.body.longitude, v.distance,
             req.body.gps_accuracy || null, selfieUrl, outStatus,
             clientIp(req), browser, Number(totalHours).toFixed(2), existing.id,
             faceCheck.matched, faceCheck.distance]
        );
        if (selfieUrl) {
            await db.query(
                `INSERT INTO attendance_selfies (user_id, attendance_id, context, url, latitude, longitude)
                 VALUES ($1,$2,'punch_out',$3,$4,$5)`,
                [uid, existing.id, selfieUrl, req.body.latitude, req.body.longitude]
            );
        }
        await logAction(uid, existing.id, 'PUNCH_OUT', { outStatus, sessHours, seq: openSess.seq, faceDistance: faceCheck.distance }, req);
        emitRealtime(req, 'attendance:update', { userId: uid, date: todayISO() });
        res.json({ ...rows[0], sessions: await sessionsFor(existing.id) });

        // Admin WhatsApp alert — fired after the response so it can never delay
        // or fail the punch-out itself; errors are caught and logged internally.
        notifyAdminsPunch(wa.notifyEmployeePunchOut, uid, fmtTimeIST(openSess.punch_in_at), fmtTimeIST(now));
    } catch (err) {
        console.error('[attendance.punchOut]', err.message);
        res.status(500).json({ error: 'Punch out failed' });
    }
};

// GET /api/attendance/me/history?from=&to=
exports.getMyHistory = async (req, res) => {
    try {
        const { from, to } = req.query;
        const params = [req.user.id];
        let where = 'user_id = $1';
        if (from) { params.push(from); where += ` AND date >= $${params.length}`; }
        if (to)   { params.push(to);   where += ` AND date <= $${params.length}`; }
        const { rows } = await db.query(
            `SELECT * FROM attendance WHERE ${where} ORDER BY date DESC`, params
        );
        res.json(rows);
    } catch (err) {
        console.error('[attendance.getMyHistory]', err.message);
        res.status(500).json({ error: 'Failed to load history' });
    }
};

// GET /api/attendance/me/monthly?month=YYYY-MM
exports.getMyMonthly = async (req, res) => {
    try {
        const summary = await monthlySummaryFor(req.user.id, req.query.month);
        res.json(summary);
    } catch (err) {
        console.error('[attendance.getMyMonthly]', err.message);
        res.status(500).json({ error: 'Failed to load monthly report' });
    }
};

// POST /api/attendance/location-change  (multipart)
exports.requestLocationChange = async (req, res) => {
    try {
        const uid = req.user.id;
        const { latitude, longitude, gps_accuracy, reason } = req.body;
        if (!latitude || !longitude)
            return res.status(400).json({ error: 'New GPS location is required.' });

        // Block duplicate pending requests
        const pending = await db.query(
            `SELECT id FROM location_change_requests WHERE user_id=$1 AND status='pending'`, [uid]
        );
        if (pending.rows.length)
            return res.status(409).json({ error: 'You already have a pending location change request.' });

        let selfieUrl = null;
        if (req.file) selfieUrl = await uploadImage(req.file, { userId: uid, context: 'location_change' });

        const { rows } = await db.query(
            `INSERT INTO location_change_requests
               (user_id, latitude, longitude, gps_accuracy_m, selfie_url, reason)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [uid, latitude, longitude, gps_accuracy || null, selfieUrl, reason || null]
        );
        await logAction(uid, null, 'LOCATION_CHANGE_REQUEST', {}, req);
        emitRealtime(req, 'attendance:location-change', { userId: uid });
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[attendance.requestLocationChange]', err.message);
        res.status(500).json({ error: 'Location change request failed' });
    }
};

/* ── Payroll-aware month computation ──────────────────────────────
   Buckets every elapsed day of the month into a status and derives paid
   (payable) days. A day with no attendance row that falls on a configured
   weekly-off day counts as WEEK_OFF (paid), never Absent. Reused by the
   self summary, the admin payroll report, and the monthly report.        */
async function computeMonth(userId, month, settings) {
    const m = month || todayISO().slice(0, 7); // YYYY-MM
    const start = `${m}-01`;
    const { rows } = await db.query(
        // `${m}-31` breaks for any month with fewer than 31 days ("date/time
        // field value out of range") — use an open-ended upper bound instead.
        `SELECT * FROM attendance WHERE user_id=$1 AND date >= $2::date AND date < ($2::date + INTERVAL '1 month') ORDER BY date`,
        [userId, start]
    );
    settings = settings || await getSettings();
    const weekOff = Array.isArray(settings.week_off_days) ? settings.week_off_days.map(Number) : [0];

    // pg returns DATE as a JS Date (local midnight) OR a string depending on
    // parser config — normalise both to YYYY-MM-DD using local components.
    const isoDate = (d) => {
        if (d instanceof Date)
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return String(d).slice(0, 10);
    };
    const byDate = new Map();
    rows.forEach((r) => byDate.set(isoDate(r.date), r));

    const now = new Date();
    const [yy, mm] = m.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const elapsed = (now.getFullYear() === yy && now.getMonth() + 1 === mm)
        ? now.getDate() : daysInMonth;

    const c = {
        present: 0, late: 0, half_day: 0, absent: 0,
        week_off: 0, paid_leave: 0, unpaid_leave: 0, holiday: 0,
        early_arrival: 0, early_exit: 0, overtime: 0, total_working_hours: 0,
    };

    for (let d = 1; d <= elapsed; d++) {
        const iso = `${m}-${String(d).padStart(2, '0')}`;
        const weekday = new Date(yy, mm - 1, d).getDay();
        const r = byDate.get(iso);
        const st = r?.attendance_status;

        // Explicit statuses win over the auto weekly-off default.
        if (st === 'week_off')          c.week_off++;
        else if (st === 'paid_leave')   c.paid_leave++;
        else if (st === 'unpaid_leave') c.unpaid_leave++;
        else if (st === 'holiday')      c.holiday++;
        else if (st === 'half_day')     c.half_day++;
        else if (st === 'absent')       c.absent++;
        else if (r && r.punch_in_at)    c.present++;               // present / late
        else if (weekOff.includes(weekday)) c.week_off++;          // auto weekly off (paid)
        else c.absent++;                                           // no punch, working day

        if (r) {
            if (r.punch_in_status === 'late') c.late++;
            if (r.punch_in_status === 'early_arrival') c.early_arrival++;
            if (r.punch_out_status === 'early_exit') c.early_exit++;
            if (r.punch_out_status === 'overtime') c.overtime++;
            c.total_working_hours += Number(r.working_hours || 0);
        }
    }

    // Paid (payable) days = Present + Week Off + Paid Leave + Holiday + half-days.
    const payable_days = c.present + c.week_off + c.paid_leave + c.holiday + c.half_day * 0.5;
    c.total_working_hours = Number(c.total_working_hours.toFixed(2));

    return { month: m, days: rows, counts: c, elapsed, days_in_month: daysInMonth, payable_days, week_off_days: weekOff };
}

/* ── Monthly summary helper (reused by self + admin reports) ────── */
async function monthlySummaryFor(userId, month) {
    const settings = await getEffectiveSettings(userId);
    const mo = await computeMonth(userId, month, settings);
    const c = mo.counts;
    const pct = mo.elapsed
        ? Math.round((c.present + c.half_day * 0.5 + c.week_off + c.paid_leave + c.holiday) / mo.elapsed * 100)
        : 0;
    return {
        month: mo.month, days: mo.days,
        summary: {
            present: c.present, absent: c.absent, late: c.late, half_day: c.half_day,
            week_off: c.week_off, paid_leave: c.paid_leave, unpaid_leave: c.unpaid_leave, holiday: c.holiday,
            early_arrival: c.early_arrival, early_exit: c.early_exit, overtime: c.overtime,
            payable_days: mo.payable_days,
            attendance_percentage: pct,
            total_working_hours: c.total_working_hours,
            min_working_hours: Number(settings.min_working_hours),
        },
    };
}
exports._monthlySummaryFor = monthlySummaryFor;

/* ══════════════════════════════════════════════════════════════════
   ADMIN — SETTINGS
══════════════════════════════════════════════════════════════════ */
exports.getSettingsPublic = async (_req, res) => {
    try { res.json(await getSettings()); }
    catch { res.status(500).json({ error: 'Failed to load settings' }); }
};

exports.updateSettings = async (req, res) => {
    try {
        const f = req.body || {};
        // week_off_days: normalise to an int[] of ISO weekdays (0=Sun … 6=Sat).
        let weekOff = null;
        if (Array.isArray(f.week_off_days))
            weekOff = f.week_off_days.map(Number).filter((n) => n >= 0 && n <= 6);
        const { rows } = await db.query(
            `UPDATE attendance_settings SET
               shift_start=COALESCE($1,shift_start),
               shift_end=COALESCE($2,shift_end),
               grace_minutes=COALESCE($3,grace_minutes),
               half_day_after=COALESCE($4,half_day_after),
               office_radius_m=COALESCE($5,office_radius_m),
               min_working_hours=COALESCE($6,min_working_hours),
               require_gps=COALESCE($7,require_gps),
               require_selfie=COALESCE($8,require_selfie),
               max_gps_accuracy_m=COALESCE($9,max_gps_accuracy_m),
               week_off_days=COALESCE($11::int[],week_off_days),
               payroll_days_basis=COALESCE($12,payroll_days_basis),
               face_match_threshold=COALESCE($13,face_match_threshold),
               updated_by=$10, updated_at=CURRENT_TIMESTAMP
             WHERE id=1 RETURNING *`,
            [f.shift_start, f.shift_end, f.grace_minutes, f.half_day_after,
             f.office_radius_m, f.min_working_hours, f.require_gps, f.require_selfie,
             f.max_gps_accuracy_m, req.user.id, weekOff, f.payroll_days_basis || null,
             f.face_match_threshold || null]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('[attendance.updateSettings]', err.message);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

/* ══════════════════════════════════════════════════════════════════
   ADMIN — REGISTRATION APPROVALS
══════════════════════════════════════════════════════════════════ */
exports.getPendingRegistrations = async (_req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT r.*, u.name, u.mobile, u.role, s.shop_name
             FROM attendance_registration r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN shops s ON s.id = r.shop_id
             WHERE r.status = 'pending'
             ORDER BY r.created_at ASC`
        );
        await signSelfieFields(rows, ['selfie_url']);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load pending registrations' });
    }
};

exports.approveRegistration = async (req, res) => {
    try {
        const settings = await getSettings();
        if (!settings) {
            return res.status(500).json({
                error: 'Attendance settings are not configured. Open Attendance → Settings and save once, then retry.',
            });
        }
        // Approve requests carry no JSON body → req.body may be undefined.
        const body = req.body || {};
        // Keep the configured 50m geofence: fall back to settings.office_radius_m (default 50).
        const radius = body.allowed_radius_m || settings.office_radius_m;
        const reg = (await db.query('SELECT * FROM attendance_registration WHERE id=$1', [req.params.id])).rows[0];
        if (!reg) return res.status(404).json({ error: 'Registration not found' });

        const { rows } = await db.query(
            `UPDATE attendance_registration SET
               status='approved',
               registered_lat=COALESCE($1, latitude),
               registered_lng=COALESCE($2, longitude),
               allowed_radius_m=$3, reviewed_by=$4, reviewed_at=CURRENT_TIMESTAMP,
               reject_reason=NULL
             WHERE id=$5 RETURNING *`,
            [body.latitude, body.longitude, radius, req.user.id, req.params.id]
        );
        // Activate the user account
        await db.query(`UPDATE users SET status='active', is_approved=true WHERE id=$1`, [reg.user_id]);
        await logAction(req.user.id, null, 'APPROVE_REG', { userId: reg.user_id }, req);
        emitRealtime(req, 'attendance:registration', { userId: reg.user_id, status: 'approved' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[attendance.approveRegistration]', err.message);
        res.status(500).json({ error: 'Approval failed' });
    }
};

exports.rejectRegistration = async (req, res) => {
    try {
        const { rows } = await db.query(
            `UPDATE attendance_registration SET status='rejected',
               reject_reason=$1, reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP
             WHERE id=$3 RETURNING *`,
            [(req.body || {}).reason || 'Rejected by admin', req.user.id, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
        await logAction(req.user.id, null, 'REJECT_REG', { id: req.params.id }, req);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Rejection failed' });
    }
};

/* ── LOCATION CHANGE APPROVALS ──────────────────────────────────── */
exports.getLocationChangeRequests = async (_req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT l.*, u.name, u.mobile, u.role
             FROM location_change_requests l
             JOIN users u ON u.id = l.user_id
             WHERE l.status='pending' ORDER BY l.created_at ASC`
        );
        await signSelfieFields(rows, ['selfie_url']);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load location change requests' });
    }
};

exports.approveLocationChange = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const lc = (await client.query('SELECT * FROM location_change_requests WHERE id=$1', [req.params.id])).rows[0];
        if (!lc) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }

        await client.query(
            `UPDATE location_change_requests SET status='approved',
               reviewed_by=$1, reviewed_at=CURRENT_TIMESTAMP WHERE id=$2`,
            [req.user.id, req.params.id]
        );
        // Apply new location to the user's registration
        await client.query(
            `UPDATE attendance_registration SET
               registered_lat=$1, registered_lng=$2, latitude=$1, longitude=$2,
               selfie_url=COALESCE($3, selfie_url),
               face_descriptor=CASE WHEN $3 IS NOT NULL THEN NULL ELSE face_descriptor END,
               face_descriptor_updated_at=CASE WHEN $3 IS NOT NULL THEN NULL ELSE face_descriptor_updated_at END
             WHERE user_id=$4`,
            [lc.latitude, lc.longitude, lc.selfie_url, lc.user_id]
        );
        await client.query('COMMIT');
        await logAction(req.user.id, null, 'APPROVE_LOCATION_CHANGE', { userId: lc.user_id }, req);
        res.json({ ok: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[attendance.approveLocationChange]', err.message);
        res.status(500).json({ error: 'Approval failed' });
    } finally {
        client.release();
    }
};

exports.rejectLocationChange = async (req, res) => {
    try {
        const { rows } = await db.query(
            `UPDATE location_change_requests SET status='rejected',
               reject_reason=$1, reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP
             WHERE id=$3 RETURNING *`,
            [(req.body || {}).reason || 'Rejected by admin', req.user.id, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Request not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Rejection failed' });
    }
};

/* ══════════════════════════════════════════════════════════════════
   ADMIN / MANAGER — DASHBOARD + TABLE
══════════════════════════════════════════════════════════════════ */

// Manager sees only their assigned shops; admin sees all.
async function shopScope(user) {
    if (user.role === 'admin') return null; // no restriction
    const { rows } = await db.query('SELECT shop_id FROM shop_users WHERE user_id=$1', [user.id]);
    return rows.map((r) => r.shop_id);
}

// GET /api/attendance/dashboard?date=
exports.getDashboardCards = async (req, res) => {
    try {
        const date = req.query.date || todayISO();
        const shops = await shopScope(req.user);
        const shopFilter = shops ? `AND (a.shop_id = ANY($2::int[]))` : '';
        const empFilter  = shops ? `AND (su.shop_id = ANY($1::int[]))` : '';

        // Total employees (shop_users in scope)
        const totalEmp = await db.query(
            `SELECT COUNT(DISTINCT su.user_id) AS c
             FROM shop_users su JOIN users u ON u.id=su.user_id
             WHERE u.status='active' ${shops ? empFilter : ''}`,
            shops ? [shops] : []
        );

        const params = shops ? [date, shops] : [date];
        const agg = await db.query(
            `SELECT
               COUNT(*) FILTER (WHERE a.punch_in_at IS NOT NULL) AS present,
               COUNT(*) FILTER (WHERE a.attendance_status='late') AS late,
               COUNT(*) FILTER (WHERE a.attendance_status='half_day') AS half_day,
               COUNT(*) FILTER (WHERE a.attendance_status='week_off') AS week_off,
               COUNT(*) FILTER (WHERE a.attendance_status IN ('paid_leave','unpaid_leave')) AS on_leave,
               COUNT(*) FILTER (WHERE a.attendance_status='holiday') AS holiday,
               COUNT(*) FILTER (WHERE a.punch_in_at IS NOT NULL AND a.punch_out_at IS NULL) AS working,
               COUNT(*) FILTER (WHERE a.punch_out_at IS NOT NULL) AS completed,
               COUNT(*) FILTER (WHERE a.punch_out_status='early_exit') AS early_exit,
               COUNT(*) FILTER (WHERE a.punch_out_status='overtime') AS overtime
             FROM attendance a WHERE a.date=$1 ${shopFilter}`,
            params
        );
        const pendingReg = await db.query(`SELECT COUNT(*) c FROM attendance_registration WHERE status='pending'`);
        const pendingLoc = await db.query(`SELECT COUNT(*) c FROM location_change_requests WHERE status='pending'`);

        const total = Number(totalEmp.rows[0].c);
        const present = Number(agg.rows[0].present);
        const weekOff = Number(agg.rows[0].week_off);
        const onLeave = Number(agg.rows[0].on_leave);
        const holiday = Number(agg.rows[0].holiday);
        res.json({
            date,
            total_employees: total,
            present_today: present,
            // Week-off / leave / holiday days are NOT counted as absent.
            absent_today: Math.max(0, total - present - weekOff - onLeave - holiday),
            week_off: weekOff,
            on_leave: onLeave,
            holiday,
            late: Number(agg.rows[0].late),
            half_day: Number(agg.rows[0].half_day),
            working: Number(agg.rows[0].working),
            completed_shift: Number(agg.rows[0].completed),
            early_exit: Number(agg.rows[0].early_exit),
            overtime: Number(agg.rows[0].overtime),
            pending_registration: Number(pendingReg.rows[0].c),
            pending_location_change: Number(pendingLoc.rows[0].c),
        });
    } catch (err) {
        console.error('[attendance.getDashboardCards]', err.message);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
};

// GET /api/attendance/shop-summary?date= — per-shop Total/Present/Absent
// cards for the Attendance Dashboard. An employee is counted under the shop
// they are currently assigned to (attendance_shop_users, falling back to
// shop_users) — the same resolution order used everywhere else for a user's
// "home" shop.
exports.getShopWiseAttendance = async (req, res) => {
    try {
        const date = req.query.date || todayISO();
        const shops = await shopScope(req.user);
        const shopFilter = shops ? 'AND s.id = ANY($2::int[])' : '';
        const params = shops ? [date, shops] : [date];

        const { rows } = await db.query(
            `WITH assign AS (
               SELECT u.id AS user_id,
                      COALESCE(
                        (SELECT asu.shop_id FROM attendance_shop_users asu
                         WHERE asu.user_id = u.id ORDER BY asu.assigned_at ASC LIMIT 1),
                        (SELECT su.shop_id FROM shop_users su
                         WHERE su.user_id = u.id ORDER BY su.assigned_at ASC LIMIT 1)
                      ) AS shop_id
               FROM users u
               WHERE u.status = 'active' AND u.role IN ('shop_user','manager')
             )
             SELECT s.id AS shop_id, s.shop_name,
                    COUNT(a.user_id) AS total,
                    COUNT(*) FILTER (WHERE att.punch_in_at IS NOT NULL) AS present
             FROM shops s
             LEFT JOIN assign a ON a.shop_id = s.id
             LEFT JOIN attendance att ON att.user_id = a.user_id AND att.date = $1
             WHERE 1=1 ${shopFilter}
             GROUP BY s.id, s.shop_name
             ORDER BY s.shop_name`,
            params
        );
        const summary = rows.map((r) => {
            const total = Number(r.total), present = Number(r.present);
            return {
                shop_id: r.shop_id, shop_name: r.shop_name,
                total, present, absent: Math.max(0, total - present),
            };
        });
        res.json({ date, shops: summary });
    } catch (err) {
        console.error('[attendance.getShopWiseAttendance]', err.message);
        res.status(500).json({ error: 'Failed to load shop-wise attendance' });
    }
};

// GET /api/attendance/table?date=&shop_id=&status=&q=
exports.getAttendanceTable = async (req, res) => {
    try {
        const date = req.query.date || todayISO();
        const shops = await shopScope(req.user);
        const params = [date];
        let where = 'a.date = $1';
        if (shops) { params.push(shops); where += ` AND a.shop_id = ANY($${params.length}::int[])`; }
        if (req.query.shop_id) { params.push(req.query.shop_id); where += ` AND a.shop_id = $${params.length}`; }
        if (req.query.status)  { params.push(req.query.status);  where += ` AND a.attendance_status = $${params.length}`; }
        if (req.query.q) {
            params.push(`%${req.query.q}%`);
            where += ` AND (u.name ILIKE $${params.length} OR u.mobile ILIKE $${params.length})`;
        }
        const { rows } = await db.query(
            `SELECT a.*, u.name, u.mobile, u.role, s.shop_name
             FROM attendance a
             JOIN users u ON u.id=a.user_id
             LEFT JOIN shops s ON s.id=a.shop_id
             WHERE ${where}
             ORDER BY a.punch_in_at DESC NULLS LAST`,
            params
        );
        await signSelfieFields(rows, ['punch_in_selfie_url', 'punch_out_selfie_url']);
        res.json(rows);
    } catch (err) {
        console.error('[attendance.getAttendanceTable]', err.message);
        res.status(500).json({ error: 'Failed to load attendance table' });
    }
};

// GET /api/attendance/detail/:id
exports.getAttendanceDetail = async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT a.*, u.name, u.mobile, u.role, s.shop_name,
                    r.registered_lat, r.registered_lng, r.allowed_radius_m, r.selfie_url AS reg_selfie_url
             FROM attendance a
             JOIN users u ON u.id=a.user_id
             LEFT JOIN shops s ON s.id=a.shop_id
             LEFT JOIN attendance_registration r ON r.user_id=a.user_id
             WHERE a.id=$1`, [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Attendance not found' });
        const logs = await db.query(
            `SELECT * FROM attendance_logs WHERE attendance_id=$1 ORDER BY created_at`, [req.params.id]
        );
        const detail = rows[0];
        await signSelfieFields(detail, ['punch_in_selfie_url', 'punch_out_selfie_url', 'reg_selfie_url']);
        const sessions = await sessionsFor(detail.id);
        await signSelfieFields(sessions, ['punch_in_selfie_url', 'punch_out_selfie_url']);
        res.json({ ...detail, sessions, timeline: logs.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load detail' });
    }
};

/* ══════════════════════════════════════════════════════════════════
   REPORTS + EXPORT
══════════════════════════════════════════════════════════════════ */

// GET /api/attendance/report?month=&scope=company|shop|employee&shop_id=&user_id=
exports.getMonthlyReport = async (req, res) => {
    try {
        const month = req.query.month || todayISO().slice(0, 7);
        const shops = await shopScope(req.user);
        const params = [`${month}-01`];
        let where = "a.date >= $1::date AND a.date < ($1::date + INTERVAL '1 month')";
        if (shops) { params.push(shops); where += ` AND a.shop_id = ANY($${params.length}::int[])`; }
        if (req.query.shop_id) { params.push(req.query.shop_id); where += ` AND a.shop_id=$${params.length}`; }
        if (req.query.user_id) { params.push(req.query.user_id); where += ` AND a.user_id=$${params.length}`; }

        const { rows } = await db.query(
            `SELECT a.user_id, u.name, u.mobile, u.role, s.shop_name,
               COUNT(*) FILTER (WHERE a.attendance_status<>'half_day' AND a.punch_in_at IS NOT NULL) AS present,
               COUNT(*) FILTER (WHERE a.attendance_status='half_day') AS half_day,
               COUNT(*) FILTER (WHERE a.punch_in_status='late') AS late,
               COUNT(*) FILTER (WHERE a.punch_in_status='early_arrival') AS early_arrival,
               COUNT(*) FILTER (WHERE a.punch_out_status='early_exit') AS early_exit,
               COUNT(*) FILTER (WHERE a.punch_out_status='overtime') AS overtime,
               COALESCE(SUM(a.working_hours),0) AS total_working_hours
             FROM attendance a
             JOIN users u ON u.id=a.user_id
             LEFT JOIN shops s ON s.id=a.shop_id
             WHERE ${where}
             GROUP BY a.user_id, u.name, u.mobile, u.role, s.shop_name
             ORDER BY u.name`,
            params
        );
        // Absent + percentage per row, based on elapsed working days
        const now = new Date();
        const [yy, mm] = month.split('-').map(Number);
        const daysInMonth = new Date(yy, mm, 0).getDate();
        const elapsed = (now.getFullYear() === yy && now.getMonth() + 1 === mm) ? now.getDate() : daysInMonth;
        const report = rows.map((r) => {
            const present = Number(r.present), half = Number(r.half_day);
            const marked = present + half;
            return {
                ...r,
                present, half_day: half,
                late: Number(r.late), early_arrival: Number(r.early_arrival),
                early_exit: Number(r.early_exit), overtime: Number(r.overtime),
                total_working_hours: Number(Number(r.total_working_hours).toFixed(2)),
                absent: Math.max(0, elapsed - marked),
                attendance_percentage: elapsed ? Math.round((present + half * 0.5) / elapsed * 100) : 0,
            };
        });
        res.json({ month, elapsed_days: elapsed, report });
    } catch (err) {
        console.error('[attendance.getMonthlyReport]', err.message);
        res.status(500).json({ error: 'Failed to build report' });
    }
};

// GET /api/attendance/export?format=csv|excel&month=&scope=...
exports.exportReport = async (req, res) => {
    try {
        // Reuse getMonthlyReport logic by calling internally
        const month = req.query.month || todayISO().slice(0, 7);
        const shops = await shopScope(req.user);
        const params = [`${month}-01`];
        let where = "a.date >= $1::date AND a.date < ($1::date + INTERVAL '1 month')";
        if (shops) { params.push(shops); where += ` AND a.shop_id = ANY($${params.length}::int[])`; }
        if (req.query.shop_id) { params.push(req.query.shop_id); where += ` AND a.shop_id=$${params.length}`; }

        const { rows } = await db.query(
            `SELECT u.name AS "Employee", u.mobile AS "Mobile", u.role AS "Role", s.shop_name AS "Shop",
               COUNT(*) FILTER (WHERE a.attendance_status<>'half_day' AND a.punch_in_at IS NOT NULL) AS "Present",
               COUNT(*) FILTER (WHERE a.attendance_status='half_day') AS "Half Day",
               COUNT(*) FILTER (WHERE a.punch_in_status='late') AS "Late",
               COUNT(*) FILTER (WHERE a.punch_in_status='early_arrival') AS "Early Arrival",
               COUNT(*) FILTER (WHERE a.punch_out_status='early_exit') AS "Early Exit",
               COUNT(*) FILTER (WHERE a.punch_out_status='overtime') AS "Overtime",
               ROUND(COALESCE(SUM(a.working_hours),0),2) AS "Total Hours"
             FROM attendance a
             JOIN users u ON u.id=a.user_id
             LEFT JOIN shops s ON s.id=a.shop_id
             WHERE ${where}
             GROUP BY u.name, u.mobile, u.role, s.shop_name ORDER BY u.name`,
            params
        );

        const format = req.query.format || 'csv';
        if (format === 'excel' || format === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Attendance ${month}`);
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', `attachment; filename="attendance-${month}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buf);
        }
        // CSV default
        const parser = new Json2csvParser();
        const csv = rows.length ? parser.parse(rows) : 'No data';
        res.setHeader('Content-Disposition', `attachment; filename="attendance-${month}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        res.send(csv);
    } catch (err) {
        console.error('[attendance.exportReport]', err.message);
        res.status(500).json({ error: 'Export failed' });
    }
};

// GET /api/attendance/shops — shops the current user may filter by
exports.getScopedShops = async (req, res) => {
    try {
        const shops = await shopScope(req.user);
        const { rows } = shops
            ? await db.query('SELECT id, shop_name FROM shops WHERE id = ANY($1::int[]) ORDER BY shop_name', [shops])
            : await db.query('SELECT id, shop_name FROM shops ORDER BY shop_name');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load shops' });
    }
};

// GET /api/attendance/recent-activity?limit=&date=
// Live punch feed: each session contributes an IN event and (if closed) an
// OUT event, newest first. Reads the existing attendance_sessions table —
// no duplicate attendance logic.
exports.getRecentActivity = async (req, res) => {
    try {
        const date = req.query.date || todayISO();
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
        const shops = await shopScope(req.user);
        const params = [date];
        const scope = shops ? (params.push(shops), `AND a.shop_id = ANY($${params.length}::int[])`) : '';
        params.push(limit);
        const limIdx = params.length;

        const { rows } = await db.query(
            `SELECT * FROM (
               SELECT s.id AS session_id, s.seq, 'IN' AS kind,
                      s.punch_in_at AS ts, u.name, u.mobile, u.role,
                      sh.shop_name, s.punch_in_device AS device, s.punch_in_browser AS browser,
                      s.punch_in_status AS status
               FROM attendance_sessions s
               JOIN attendance a ON a.id = s.attendance_id
               JOIN users u ON u.id = s.user_id
               LEFT JOIN shops sh ON sh.id = a.shop_id
               WHERE s.date = $1 AND s.punch_in_at IS NOT NULL ${scope}
               UNION ALL
               SELECT s.id, s.seq, 'OUT',
                      s.punch_out_at, u.name, u.mobile, u.role,
                      sh.shop_name, s.punch_in_device, s.punch_out_browser,
                      s.punch_out_status
               FROM attendance_sessions s
               JOIN attendance a ON a.id = s.attendance_id
               JOIN users u ON u.id = s.user_id
               LEFT JOIN shops sh ON sh.id = a.shop_id
               WHERE s.date = $1 AND s.punch_out_at IS NOT NULL ${scope}
             ) e
             ORDER BY e.ts DESC
             LIMIT $${limIdx}`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('[attendance.getRecentActivity]', err.message);
        res.status(500).json({ error: 'Failed to load recent activity' });
    }
};

/* ══════════════════════════════════════════════════════════════════
   PAYROLL — day status, salary config, salary calculation
══════════════════════════════════════════════════════════════════ */

const DAY_STATUSES = ['present', 'absent', 'week_off', 'paid_leave', 'unpaid_leave', 'half_day', 'holiday'];

// PUT /api/attendance/day-status  { user_id, date, status }
// Admin/manager sets a day's status (WEEK_OFF / leave / holiday), creating
// the attendance row if the employee has no punch that day. Never touches
// punch data — only the manual status flag.
exports.setDayStatus = async (req, res) => {
    try {
        const { user_id, date, status } = req.body || {};
        if (!user_id || !date || !DAY_STATUSES.includes(status))
            return res.status(400).json({ error: `status must be one of: ${DAY_STATUSES.join(', ')}` });

        // Manager scope guard.
        const shops = await shopScope(req.user);
        if (shops) {
            const inScope = (await db.query(
                'SELECT 1 FROM shop_users WHERE user_id=$1 AND shop_id = ANY($2::int[]) LIMIT 1', [user_id, shops]
            )).rows[0];
            if (!inScope) return res.status(403).json({ error: 'Employee is outside your shops.' });
        }

        const shopId = await resolveShopId(user_id);
        const { rows } = await db.query(
            `INSERT INTO attendance (user_id, shop_id, date, attendance_status, status_source)
             VALUES ($1,$2,$3,$4,'manual')
             ON CONFLICT (user_id, date) DO UPDATE SET
               attendance_status=$4, status_source='manual', updated_at=CURRENT_TIMESTAMP
             RETURNING *`,
            [user_id, shopId, date, status]
        );
        await logAction(req.user.id, rows[0].id, 'SET_DAY_STATUS', { user_id, date, status }, req);
        emitRealtime(req, 'attendance:update', { userId: user_id, date });
        res.json(rows[0]);
    } catch (err) {
        console.error('[attendance.setDayStatus]', err.message);
        res.status(500).json({ error: 'Failed to set day status' });
    }
};

// PUT /api/attendance/manual — Admin-only back-date attendance marking/editing.
// { user_id, date, status, punch_in_time, punch_out_time, remarks }
// punch_in_time/punch_out_time are "HH:MM" (24h) local times, optional and
// only meaningful for status='present'/'half_day'. Always stamped
// status_source='manual_admin' and recorded in both attendance_logs
// (per-attendance timeline) and audit_logs (before/after values), so every
// manual edit is traceable to the admin who made it.
exports.setManualAttendance = async (req, res) => {
    try {
        const { user_id, date, status, punch_in_time, punch_out_time, remarks } = req.body || {};
        if (!user_id || !date || !DAY_STATUSES.includes(status))
            return res.status(400).json({ error: `status must be one of: ${DAY_STATUSES.join(', ')}` });

        const before = (await db.query(
            'SELECT * FROM attendance WHERE user_id=$1 AND date=$2', [user_id, date]
        )).rows[0] || null;

        const shopId = before?.shop_id || await resolveShopId(user_id);
        const punchInAt  = punch_in_time  ? new Date(`${date}T${punch_in_time}:00`)  : null;
        const punchOutAt = punch_out_time ? new Date(`${date}T${punch_out_time}:00`) : null;
        let workingHours = null;
        if (punchInAt && punchOutAt && punchOutAt > punchInAt) {
            workingHours = Number(((punchOutAt - punchInAt) / 3_600_000).toFixed(2));
        }

        const { rows } = await db.query(
            `INSERT INTO attendance
               (user_id, shop_id, date, attendance_status, status_source,
                punch_in_at, punch_out_at, working_hours, remarks,
                manually_edited_by, manually_edited_at)
             VALUES ($1,$2,$3,$4,'manual_admin',$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, date) DO UPDATE SET
               attendance_status=$4, status_source='manual_admin',
               punch_in_at=$5, punch_out_at=$6, working_hours=$7, remarks=$8,
               manually_edited_by=$9, manually_edited_at=CURRENT_TIMESTAMP,
               updated_at=CURRENT_TIMESTAMP
             RETURNING *`,
            [user_id, shopId, date, status, punchInAt, punchOutAt, workingHours, remarks || null, req.user.id]
        );
        const after = rows[0];

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('attendance', $1, $2, $3, $4)`,
            [after.id, before ? JSON.stringify(before) : null, JSON.stringify(after), req.user.id]
        );
        await logAction(req.user.id, after.id, 'ADMIN_BACKDATE_EDIT', { user_id, date, status, punch_in_time, punch_out_time, remarks }, req);
        emitRealtime(req, 'attendance:update', { userId: Number(user_id), date });
        res.json(after);
    } catch (err) {
        console.error('[attendance.setManualAttendance]', err.message);
        res.status(500).json({ error: 'Failed to save manual attendance' });
    }
};

// GET /api/attendance/employees?shop_id= — list employees with their monthly salary
exports.getEmployeeSalaries = async (req, res) => {
    try {
        const shops = await shopScope(req.user);
        const params = [];
        let where = "u.status='active'";
        if (shops) {
            params.push(shops);
            where += ` AND EXISTS (SELECT 1 FROM shop_users su WHERE su.user_id=u.id AND su.shop_id = ANY($${params.length}::int[]))`;
        }
        if (req.query.shop_id) {
            params.push(req.query.shop_id);
            where += ` AND EXISTS (SELECT 1 FROM shop_users su WHERE su.user_id=u.id AND su.shop_id = $${params.length})`;
        }
        const { rows } = await db.query(
            `SELECT u.id AS user_id, u.name, u.mobile, u.role,
                    COALESCE(r.monthly_salary,0) AS monthly_salary,
                    r.status AS registration_status, s.shop_name
             FROM users u
             LEFT JOIN attendance_registration r ON r.user_id = u.id
             LEFT JOIN shops s ON s.id = r.shop_id
             WHERE ${where}
             ORDER BY u.name`, params
        );
        res.json(rows);
    } catch (err) {
        console.error('[attendance.getEmployeeSalaries]', err.message);
        res.status(500).json({ error: 'Failed to load employees' });
    }
};

// PUT /api/attendance/employees/:userId/salary  { monthly_salary }
exports.setEmployeeSalary = async (req, res) => {
    try {
        const salary = Number((req.body || {}).monthly_salary);
        if (!(salary >= 0)) return res.status(400).json({ error: 'monthly_salary must be a non-negative number.' });
        const uid = req.params.userId;
        const shopId = await resolveShopId(uid);
        // Upsert on the registration row so salary persists even pre-approval.
        const { rows } = await db.query(
            `INSERT INTO attendance_registration (user_id, shop_id, monthly_salary, status)
             VALUES ($1,$2,$3,'pending')
             ON CONFLICT (user_id) DO UPDATE SET monthly_salary=$3
             RETURNING user_id, monthly_salary`,
            [uid, shopId, salary]
        );
        await logAction(req.user.id, null, 'SET_SALARY', { user_id: uid, monthly_salary: salary }, req);
        res.json(rows[0]);
    } catch (err) {
        console.error('[attendance.setEmployeeSalary]', err.message);
        res.status(500).json({ error: 'Failed to set salary' });
    }
};

// GET /api/attendance/payroll?month=YYYY-MM&shop_id=&user_id=
// Computes payable days + gross/net salary per employee for the month.
exports.getPayroll = async (req, res) => {
    try {
        const month = req.query.month || todayISO().slice(0, 7);
        const settings = await getSettings();
        const shops = await shopScope(req.user);

        // Which employees to include (active, in scope, with a registration/salary).
        const params = [];
        let where = "u.status='active'";
        if (shops) {
            params.push(shops);
            where += ` AND EXISTS (SELECT 1 FROM shop_users su WHERE su.user_id=u.id AND su.shop_id = ANY($${params.length}::int[]))`;
        }
        if (req.query.user_id) { params.push(req.query.user_id); where += ` AND u.id=$${params.length}`; }

        // Shop shown/filtered in Payroll must match Attendance Assignments
        // (attendance_shop_users), not the stale one-time shop_id captured on
        // the registration row — same primary-shop precedence already used
        // for the attendance dashboard (attendance_shop_users first, then the
        // legacy shop_users fallback for anyone never explicitly assigned).
        if (req.query.shop_id) {
            params.push(req.query.shop_id);
            where += ` AND assign.shop_id=$${params.length}`;
        }

        // Per-user salary override (attendance_user_settings) wins over the
        // registration salary when set.
        const { rows: emps } = await db.query(
            `SELECT u.id AS user_id, u.name, u.mobile, u.role,
                    COALESCE(us.monthly_salary, r.monthly_salary, 0) AS monthly_salary, s.shop_name
             FROM users u
             LEFT JOIN attendance_registration r ON r.user_id = u.id
             LEFT JOIN attendance_user_settings us ON us.user_id = u.id
             LEFT JOIN LATERAL (
                 SELECT COALESCE(
                     (SELECT asu.shop_id FROM attendance_shop_users asu
                      WHERE asu.user_id = u.id ORDER BY asu.assigned_at ASC LIMIT 1),
                     (SELECT su.shop_id FROM shop_users su
                      WHERE su.user_id = u.id ORDER BY su.assigned_at ASC LIMIT 1)
                 ) AS shop_id
             ) assign ON true
             LEFT JOIN shops s ON s.id = assign.shop_id
             WHERE ${where}
             ORDER BY u.name`, params
        );

        const report = [];
        for (const e of emps) {
            const eff = await getEffectiveSettings(e.user_id);
            const mo = await computeMonth(e.user_id, month, eff);
            const c = mo.counts;
            const divisor = settings.payroll_days_basis === 'fixed30' ? 30 : mo.days_in_month;
            const monthlySalary = Number(e.monthly_salary || 0);
            const perDay = divisor ? monthlySalary / divisor : 0;
            const gross = Number((perDay * mo.payable_days).toFixed(2));
            const net = gross; // deductions layer can be added later
            report.push({
                user_id: e.user_id, name: e.name, mobile: e.mobile, role: e.role, shop_name: e.shop_name,
                monthly_salary: monthlySalary,
                present: c.present, half_day: c.half_day, week_off: c.week_off,
                paid_leave: c.paid_leave, unpaid_leave: c.unpaid_leave,
                holiday: c.holiday, absent: c.absent,
                payable_days: mo.payable_days,
                days_in_month: mo.days_in_month, payroll_divisor: divisor,
                per_day_rate: Number(perDay.toFixed(2)),
                total_working_hours: c.total_working_hours,
                gross_salary: gross, net_salary: net,
            });
        }
        res.json({ month, days_basis: settings.payroll_days_basis, report });
    } catch (err) {
        console.error('[attendance.getPayroll]', err.message);
        res.status(500).json({ error: 'Failed to build payroll' });
    }
};

/* ══════════════════════════════════════════════════════════════════
   PER-EMPLOYEE SETTINGS (attendance rules + payroll, admin)
══════════════════════════════════════════════════════════════════ */

// Guard: managers may only touch employees in their shops.
async function assertUserInScope(actor, userId, res) {
    const shops = await shopScope(actor);
    if (!shops) return true; // admin
    const ok = (await db.query(
        'SELECT 1 FROM shop_users WHERE user_id=$1 AND shop_id = ANY($2::int[]) LIMIT 1', [userId, shops]
    )).rows[0];
    if (!ok) { res.status(403).json({ error: 'Employee is outside your shops.' }); return false; }
    return true;
}

// GET /api/attendance/user-settings/:userId
// Returns global defaults, the user's raw overrides, the effective merged
// values, the assigned shop (with GPS/radius), and a current-month payroll
// preview so the admin sees exactly what will apply.
exports.getUserSettings = async (req, res) => {
    try {
        const uid = req.params.userId;
        if (!(await assertUserInScope(req.user, uid, res))) return;

        const global = await getSettings();
        const override = (await db.query('SELECT * FROM attendance_user_settings WHERE user_id=$1', [uid])).rows[0] || null;
        const effective = await getEffectiveSettings(uid);
        const reg = (await db.query('SELECT * FROM attendance_registration WHERE user_id=$1', [uid])).rows[0] || null;

        const assignedShops = await getAssignedShopsWithGeofence(uid);
        const shop = assignedShops[0] || null;
        const office = await resolveOffice(uid, reg, effective);

        const salary = (override?.monthly_salary != null) ? override.monthly_salary
            : (reg?.monthly_salary != null ? reg.monthly_salary : 0);

        // Current-month payroll preview for this user.
        const month = req.query.month || todayISO().slice(0, 7);
        const mo = await computeMonth(uid, month, effective);
        const divisor = global.payroll_days_basis === 'fixed30' ? 30 : mo.days_in_month;
        const perDay = divisor ? Number(salary) / divisor : 0;
        const payroll = {
            month, monthly_salary: Number(salary),
            present: mo.counts.present, half_day: mo.counts.half_day,
            week_off: mo.counts.week_off, paid_leave: mo.counts.paid_leave,
            unpaid_leave: mo.counts.unpaid_leave, holiday: mo.counts.holiday,
            absent: mo.counts.absent, payable_days: mo.payable_days,
            per_day_rate: Number(perDay.toFixed(2)),
            gross_salary: Number((perDay * mo.payable_days).toFixed(2)),
        };
        payroll.net_salary = payroll.gross_salary;

        res.json({ user_id: Number(uid), global, override, effective, registration: reg, shop, assigned_shops: assignedShops, office, payroll });
    } catch (err) {
        console.error('[attendance.getUserSettings]', err.message);
        res.status(500).json({ error: 'Failed to load user settings' });
    }
};

// PUT /api/attendance/user-settings/:userId
// Upserts per-user overrides. Any field sent as null/'' clears the override
// (=> inherit global). monthly_salary is mirrored to the registration row so
// existing payroll queries keep working.
exports.saveUserSettings = async (req, res) => {
    try {
        const uid = req.params.userId;
        if (!(await assertUserInScope(req.user, uid, res))) return;
        const b = req.body || {};

        // Normalise "clear" (null / '' ) vs value. Numbers coerced.
        const numOrNull = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);
        const timeOrNull = (v) => (v === '' || v === null || v === undefined) ? null : v;
        const boolOrNull = (v) => (v === null || v === undefined) ? null : !!v;
        let weekOff = null;
        if (Array.isArray(b.week_off_days))
            weekOff = b.week_off_days.map(Number).filter((n) => n >= 0 && n <= 6);

        const { rows } = await db.query(
            `INSERT INTO attendance_user_settings
               (user_id, shift_start, shift_end, grace_minutes, half_day_after,
                min_working_hours, require_gps, require_selfie, max_gps_accuracy_m,
                week_off_days, office_radius_m, enforce_shop_location, monthly_salary,
                updated_by, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
               shift_start=$2, shift_end=$3, grace_minutes=$4, half_day_after=$5,
               min_working_hours=$6, require_gps=$7, require_selfie=$8, max_gps_accuracy_m=$9,
               week_off_days=$10, office_radius_m=$11, enforce_shop_location=$12,
               monthly_salary=$13, updated_by=$14, updated_at=CURRENT_TIMESTAMP
             RETURNING *`,
            [uid, timeOrNull(b.shift_start), timeOrNull(b.shift_end), numOrNull(b.grace_minutes),
             timeOrNull(b.half_day_after), numOrNull(b.min_working_hours),
             boolOrNull(b.require_gps), boolOrNull(b.require_selfie), numOrNull(b.max_gps_accuracy_m),
             weekOff, numOrNull(b.office_radius_m), boolOrNull(b.enforce_shop_location),
             numOrNull(b.monthly_salary), req.user.id]
        );

        // Mirror salary onto the registration row (source of truth for legacy payroll).
        if (b.monthly_salary !== '' && b.monthly_salary != null) {
            const shopId = await resolveShopId(uid);
            await db.query(
                `INSERT INTO attendance_registration (user_id, shop_id, monthly_salary, status)
                 VALUES ($1,$2,$3,'pending')
                 ON CONFLICT (user_id) DO UPDATE SET monthly_salary=$3`,
                [uid, shopId, Number(b.monthly_salary)]
            );
        }
        await logAction(req.user.id, null, 'SAVE_USER_SETTINGS', { user_id: uid }, req);
        emitRealtime(req, 'attendance:update', { userId: Number(uid) });
        res.json(rows[0]);
    } catch (err) {
        console.error('[attendance.saveUserSettings]', err.message);
        res.status(500).json({ error: 'Failed to save user settings' });
    }
};

/* ══════════════════════════════════════════════════════════════════
   ATTENDANCE ASSIGNMENT MODULE ENDPOINTS (Admin only)
══════════════════════════════════════════════════════════════════ */

// GET /api/attendance/assignments — list users with attendance shop assignments
exports.getAttendanceAssignments = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                u.id, u.name, u.mobile, u.role, u.status,
                (SELECT COALESCE(json_agg(d), '[]'::json)
                 FROM (
                     SELECT json_build_object(
                         'id', s.id,
                         'name', s.shop_name,
                         'latitude', s.latitude,
                         'longitude', s.longitude,
                         'geofence_radius_m', COALESCE(s.geofence_radius_m, 50),
                         'assigned_at', asu.assigned_at
                     ) AS d
                     FROM attendance_shop_users asu
                     JOIN shops s ON s.id = asu.shop_id
                     WHERE asu.user_id = u.id
                     ORDER BY asu.assigned_at ASC
                 ) ordered_shops) AS attendance_shops
             FROM users u
             WHERE u.status = 'active' AND u.role IN ('shop_user', 'manager')
             ORDER BY u.name ASC, u.id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[attendance.getAttendanceAssignments]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/attendance/assignments/user/:userId — list attendance shops for a user
exports.getUserAttendanceShops = async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query(
            `SELECT s.id, s.shop_name, s.latitude, s.longitude,
                    COALESCE(s.geofence_radius_m, 50) AS geofence_radius_m,
                    asu.assigned_at, ab.name AS assigned_by_name
             FROM attendance_shop_users asu
             JOIN shops s ON s.id = asu.shop_id
             LEFT JOIN users ab ON ab.id = asu.assigned_by
             WHERE asu.user_id = $1
             ORDER BY asu.assigned_at ASC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/attendance/assignments/user/:userId — assign a shop to user for attendance
exports.assignUserAttendanceShop = async (req, res) => {
    try {
        const { userId } = req.params;
        const { shopId } = req.body;

        if (!shopId) return res.status(400).json({ error: 'shopId is required' });

        const shopCheck = await db.query('SELECT id, shop_name FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const ins = await db.query(
            `INSERT INTO attendance_shop_users (shop_id, user_id, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (shop_id, user_id) DO NOTHING
             RETURNING id`,
            [shopId, userId, req.user.id]
        );

        const alreadyAssigned = ins.rows.length === 0;
        res.json({
            message: alreadyAssigned ? 'Attendance shop already assigned' : 'Attendance shop assigned successfully',
            shop: shopCheck.rows[0],
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/attendance/assignments/user/:userId/shop/:shopId — unassign an attendance shop from a user
exports.unassignUserAttendanceShop = async (req, res) => {
    try {
        const { userId, shopId } = req.params;
        const result = await db.query(
            'DELETE FROM attendance_shop_users WHERE user_id = $1 AND shop_id = $2 RETURNING id',
            [userId, shopId]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Attendance assignment not found' });
        res.json({ message: 'Attendance shop unassigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
