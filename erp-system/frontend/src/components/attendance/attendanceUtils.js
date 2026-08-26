// Shared helpers for the Attendance module.
import api from '../../services/api';

export const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

// Resolve a stored selfie URL to an absolute, displayable URL.
export const mediaUrl = (u) => {
    if (!u) return '';
    if (/^https?:\/\//.test(u)) return u;        // S3 / absolute
    return `${BACKEND_URL}${u}`;                  // local /uploads path
};

// Promise wrapper around the Geolocation API (high accuracy).
export function getPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('GPS not supported by this browser.'));
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
            }),
            (err) => reject(new Error(
                err.code === 1 ? 'Location permission denied. Please allow GPS.' :
                err.code === 2 ? 'Location unavailable. Move to an open area.' :
                'Location request timed out. Please retry.'
            )),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
}

// Haversine distance in metres.
const toRad = (v) => (v * Math.PI) / 180;
export function distanceM(lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some((v) => v == null || isNaN(v))) return null;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const googleMapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
// Keyless OpenStreetMap embed centred on the pin.
export const osmEmbed = (lat, lng) => {
    const d = 0.003;
    const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
};

// Status label + colour maps
export const PUNCH_IN_STATUS = {
    early_arrival: { label: 'Early Arrival', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    on_time:       { label: 'On Time',       cls: 'bg-green-100 text-green-700 border-green-200' },
    late:          { label: 'Late',          cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    half_day:      { label: 'Half Day',      cls: 'bg-orange-100 text-orange-700 border-orange-200' },
};
export const PUNCH_OUT_STATUS = {
    early_exit: { label: 'Early Exit', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    on_time:    { label: 'On Time',    cls: 'bg-green-100 text-green-700 border-green-200' },
    overtime:   { label: 'Overtime',   cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
};
export const ATT_STATUS = {
    present:      { label: 'Present',      cls: 'bg-green-100 text-green-700 border-green-200' },
    late:         { label: 'Late',         cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    half_day:     { label: 'Half Day',     cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    absent:       { label: 'Absent',       cls: 'bg-red-100 text-red-700 border-red-200' },
    week_off:     { label: 'Week Off',     cls: 'bg-sky-100 text-sky-700 border-sky-200' },
    paid_leave:   { label: 'Paid Leave',   cls: 'bg-teal-100 text-teal-700 border-teal-200' },
    unpaid_leave: { label: 'Unpaid Leave', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    holiday:      { label: 'Holiday',      cls: 'bg-violet-100 text-violet-700 border-violet-200' },
};

// Day-status options an admin/manager can set on the payroll/attendance grid.
export const DAY_STATUS_OPTIONS = [
    { value: 'present',      label: 'Present' },
    { value: 'week_off',     label: 'Week Off (paid)' },
    { value: 'paid_leave',   label: 'Paid Leave' },
    { value: 'unpaid_leave', label: 'Unpaid Leave' },
    { value: 'half_day',     label: 'Half Day' },
    { value: 'holiday',      label: 'Holiday (paid)' },
    { value: 'absent',       label: 'Absent' },
];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const fmtTime = (t) => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
export const to12h = (t) => {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
};

// Build multipart FormData for a punch/registration payload.
export function buildFormData({ selfie, latitude, longitude, accuracy, extra = {} }) {
    const fd = new FormData();
    if (selfie) fd.append('selfie', selfie, 'selfie.jpg');
    if (latitude != null) fd.append('latitude', latitude);
    if (longitude != null) fd.append('longitude', longitude);
    if (accuracy != null) fd.append('gps_accuracy', accuracy);
    Object.entries(extra).forEach(([k, v]) => v != null && fd.append(k, v));
    return fd;
}

export const attApi = api; // convenience re-export
