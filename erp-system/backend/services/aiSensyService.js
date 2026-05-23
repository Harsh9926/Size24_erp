const https = require('https');

const API_KEY = process.env.AISENSY_API_KEY;
const ENABLED = !!API_KEY;

const CAMPAIGNS = {
    entry_approved:  process.env.AISENSY_TPL_APPROVED       || 'entry_approved',
    entry_rejected:  process.env.AISENSY_TPL_REJECTED       || 'entry_rejected',
    entry_reminder:  process.env.AISENSY_TPL_REMINDER       || 'entry_reminder',
    admin_summary:   process.env.AISENSY_TPL_ADMIN_SUMMARY  || 'daily_admin_summary',
};

/* Normalize phone → "91XXXXXXXXXX" */
function normalizePhone(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return digits;
    if (digits.length === 10) return `91${digits}`;
    return digits;
}

function sendWhatsApp(phone, campaignName, templateParams = []) {
    if (!ENABLED) return Promise.resolve({ skipped: true, reason: 'AISENSY_API_KEY not set' });

    const destination = normalizePhone(phone);
    if (!destination) return Promise.resolve({ skipped: true, reason: 'invalid phone' });

    const payload = JSON.stringify({
        apiKey:         API_KEY,
        campaignName,
        destination,
        userName:       'Size24',
        templateParams,
        source:         'SIZE24 ERP',
        media:          {},
        buttons:        [],
        carouselCards:  [],
        location:       {},
        paramsFallbackValue: { FirstName: 'User' },
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'backend.aisensy.com',
            path:     '/campaign/t1/api/v2',
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

/* ── Notification helpers ───────────────────────────────────────── */

exports.notifyEntryApproved = (phone, shopName, date, amount) =>
    sendWhatsApp(phone, CAMPAIGNS.entry_approved, [shopName, date, String(amount)])
        .catch(err => console.error('[AiSensy] approved notify failed:', err.message));

exports.notifyEntryRejected = (phone, shopName, date, reason) =>
    sendWhatsApp(phone, CAMPAIGNS.entry_rejected, [shopName, date, reason || 'No reason provided'])
        .catch(err => console.error('[AiSensy] rejected notify failed:', err.message));

exports.notifyReminder = (phone, shopName) =>
    sendWhatsApp(phone, CAMPAIGNS.entry_reminder, [shopName])
        .catch(err => console.error('[AiSensy] reminder notify failed:', err.message));

/* Admin daily summary — {{1}} = date, {{2}} = missing count, {{3}} = shop names list */
exports.notifyAdminSummary = (phone, date, missingCount, shopList) =>
    sendWhatsApp(phone, CAMPAIGNS.admin_summary, [date, String(missingCount), shopList])
        .catch(err => console.error('[AiSensy] admin summary failed:', err.message));

exports.ENABLED = ENABLED;
