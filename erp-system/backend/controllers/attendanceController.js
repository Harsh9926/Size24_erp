// erp-system/backend/controllers/attendanceController.js
// Employee Attendance Management Module.
// Roles: 'shop_user' = Employee, 'manager', 'admin'.

const db = require('../config/db');
const { uploadImage, signSelfieFields } = require('../services/storageService');
const { Parser: Json2csvParser } = require('json2csv');
const XLSX = require('xlsx');

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

/* ══════════════════════════════════════════════════════════════════
   SELF / EMPLOYEE + MANAGER ENDPOINTS
══════════════════════════════════════════════════════════════════ */

// GET /api/attendance/me — today's status + registration + settings
exports.getMyStatus = async (req, res) => {
    try {
        const uid = req.user.id;
        const [settings, regRes, todayRes] = await Promise.all([
            getSettings(),
            db.query('SELECT * FROM attendance_registration WHERE user_id = $1', [uid]),
            db.query('SELECT * FROM attendance WHERE user_id = $1 AND date = $2', [uid, todayISO()]),
        ]);
        const registration = regRes.rows[0] || null;
        const today = todayRes.rows[0] || null;
        await signSelfieFields(registration, ['selfie_url']);
        await signSelfieFields(today, ['punch_in_selfie_url', 'punch_out_selfie_url']);
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
               reviewed_by=NULL, reviewed_at=NULL, created_at=CURRENT_TIMESTAMP
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

// Shared validation for a punch. Returns { ok, error, distance }
function validatePunch(reg, settings, body, hasFile) {
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

    const dist = distanceM(
        Number(latitude), Number(longitude),
        Number(reg.registered_lat), Number(reg.registered_lng)
    );
    const radius = reg.allowed_radius_m || settings.office_radius_m;
    if (settings.require_gps && dist != null && dist > radius)
        return { error: 'You are outside your registered office location.', distance: dist };
    return { ok: true, distance: dist };
}

// POST /api/attendance/punch-in
exports.punchIn = async (req, res) => {
    try {
        const uid = req.user.id;
        const settings = await getSettings();
        const reg = (await db.query('SELECT * FROM attendance_registration WHERE user_id=$1', [uid])).rows[0];

        const existing = (await db.query(
            'SELECT * FROM attendance WHERE user_id=$1 AND date=$2', [uid, todayISO()]
        )).rows[0];
        if (existing?.punch_in_at)
            return res.status(409).json({ error: 'You have already punched in today.' });

        const v = validatePunch(reg, settings, req.body, !!req.file);
        if (v.error) return res.status(400).json({ error: v.error, distance: v.distance });

        let selfieUrl = null;
        if (req.file) selfieUrl = await uploadImage(req.file, { userId: uid, context: 'punch_in' });

        const now = new Date();
        const inStatus = punchInStatus(now, settings);
        const { browser, device } = parseUA(req.headers['user-agent']);
        const shopId = await resolveShopId(uid);

        const { rows } = await db.query(
            `INSERT INTO attendance
               (user_id, shop_id, date, punch_in_at, punch_in_lat, punch_in_lng,
                punch_in_distance_m, punch_in_accuracy_m, punch_in_selfie_url,
                punch_in_status, punch_in_ip, punch_in_browser, punch_in_device,
                attendance_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (user_id, date) DO UPDATE SET
               punch_in_at=$4, punch_in_lat=$5, punch_in_lng=$6, punch_in_distance_m=$7,
               punch_in_accuracy_m=$8, punch_in_selfie_url=$9, punch_in_status=$10,
               punch_in_ip=$11, punch_in_browser=$12, punch_in_device=$13,
               attendance_status=$14, updated_at=CURRENT_TIMESTAMP
             RETURNING *`,
            [uid, shopId, todayISO(), now, req.body.latitude, req.body.longitude,
             v.distance, req.body.gps_accuracy || null, selfieUrl, inStatus,
             clientIp(req), browser, device, overallStatus(inStatus)]
        );
        if (selfieUrl) {
            await db.query(
                `INSERT INTO attendance_selfies (user_id, attendance_id, context, url, latitude, longitude)
                 VALUES ($1,$2,'punch_in',$3,$4,$5)`,
                [uid, rows[0].id, selfieUrl, req.body.latitude, req.body.longitude]
            );
        }
        await logAction(uid, rows[0].id, 'PUNCH_IN', { inStatus, distance: v.distance }, req);
        emitRealtime(req, 'attendance:update', { userId: uid, date: todayISO() });
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('[attendance.punchIn]', err.message);
        res.status(500).json({ error: 'Punch in failed' });
    }
};

// POST /api/attendance/punch-out
exports.punchOut = async (req, res) => {
    try {
        const uid = req.user.id;
        const settings = await getSettings();
        const reg = (await db.query('SELECT * FROM attendance_registration WHERE user_id=$1', [uid])).rows[0];

        const existing = (await db.query(
            'SELECT * FROM attendance WHERE user_id=$1 AND date=$2', [uid, todayISO()]
        )).rows[0];
        if (!existing?.punch_in_at)
            return res.status(400).json({ error: 'You must punch in before punching out.' });
        if (existing.punch_out_at)
            return res.status(409).json({ error: 'You have already punched out today.' });

        const v = validatePunch(reg, settings, req.body, !!req.file);
        if (v.error) return res.status(400).json({ error: v.error, distance: v.distance });

        let selfieUrl = null;
        if (req.file) selfieUrl = await uploadImage(req.file, { userId: uid, context: 'punch_out' });

        const now = new Date();
        const outStatus = punchOutStatus(now, settings);
        const workingHours = Math.max(0,
            (now - new Date(existing.punch_in_at)) / 3_600_000
        ).toFixed(2);
        const { browser, device } = parseUA(req.headers['user-agent']);

        const { rows } = await db.query(
            `UPDATE attendance SET
               punch_out_at=$1, punch_out_lat=$2, punch_out_lng=$3, punch_out_distance_m=$4,
               punch_out_accuracy_m=$5, punch_out_selfie_url=$6, punch_out_status=$7,
               punch_out_ip=$8, punch_out_browser=$9, working_hours=$10,
               updated_at=CURRENT_TIMESTAMP
             WHERE id=$11 RETURNING *`,
            [now, req.body.latitude, req.body.longitude, v.distance,
             req.body.gps_accuracy || null, selfieUrl, outStatus,
             clientIp(req), browser, workingHours, existing.id]
        );
        if (selfieUrl) {
            await db.query(
                `INSERT INTO attendance_selfies (user_id, attendance_id, context, url, latitude, longitude)
                 VALUES ($1,$2,'punch_out',$3,$4,$5)`,
                [uid, existing.id, selfieUrl, req.body.latitude, req.body.longitude]
            );
        }
        await logAction(uid, existing.id, 'PUNCH_OUT', { outStatus, workingHours }, req);
        emitRealtime(req, 'attendance:update', { userId: uid, date: todayISO() });
        res.json(rows[0]);
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

/* ── Monthly summary helper (reused by self + admin reports) ────── */
async function monthlySummaryFor(userId, month) {
    const m = month || todayISO().slice(0, 7); // YYYY-MM
    const start = `${m}-01`;
    const end   = `${m}-31`;
    const { rows } = await db.query(
        `SELECT * FROM attendance WHERE user_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date`,
        [userId, start, end]
    );
    const settings = await getSettings();
    let present = 0, late = 0, halfDay = 0, earlyArrival = 0, earlyExit = 0, overtime = 0, totalHours = 0;
    for (const r of rows) {
        if (r.attendance_status === 'half_day') halfDay++;
        else present++;
        if (r.punch_in_status === 'late') late++;
        if (r.punch_in_status === 'early_arrival') earlyArrival++;
        if (r.punch_out_status === 'early_exit') earlyExit++;
        if (r.punch_out_status === 'overtime') overtime++;
        totalHours += Number(r.working_hours || 0);
    }
    // Working days elapsed this month (up to today if current month)
    const now = new Date();
    const [yy, mm] = m.split('-').map(Number);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const elapsed = (now.getFullYear() === yy && now.getMonth() + 1 === mm)
        ? now.getDate() : daysInMonth;
    const absent = Math.max(0, elapsed - rows.length);
    const pct = elapsed ? Math.round((present + halfDay * 0.5) / elapsed * 100) : 0;

    return {
        month: m, days: rows,
        summary: {
            present, absent, late, half_day: halfDay,
            early_arrival: earlyArrival, early_exit: earlyExit, overtime,
            attendance_percentage: pct,
            total_working_hours: Number(totalHours.toFixed(2)),
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
               updated_by=$10, updated_at=CURRENT_TIMESTAMP
             WHERE id=1 RETURNING *`,
            [f.shift_start, f.shift_end, f.grace_minutes, f.half_day_after,
             f.office_radius_m, f.min_working_hours, f.require_gps, f.require_selfie,
             f.max_gps_accuracy_m, req.user.id]
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
               selfie_url=COALESCE($3, selfie_url)
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
        res.json({
            date,
            total_employees: total,
            present_today: present,
            absent_today: Math.max(0, total - present),
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
        res.json({ ...detail, timeline: logs.rows });
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
        const params = [`${month}-01`, `${month}-31`];
        let where = 'a.date BETWEEN $1 AND $2';
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
        const params = [`${month}-01`, `${month}-31`];
        let where = 'a.date BETWEEN $1 AND $2';
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
