/**
 * MSG91 WhatsApp + SMS notification service
 *
 * Required env vars (add to .env on server):
 *   MSG91_AUTH_KEY          — API key from MSG91 dashboard
 *   MSG91_SENDER_ID         — SMS sender ID (e.g. SIZE24)
 *   MSG91_WHATSAPP_NUMBER   — Your WhatsApp Business number (e.g. 917XXXXXXXXXX)
 *
 * MSG91 WhatsApp template IDs (create these in MSG91 → WhatsApp → Templates):
 *   MSG91_TPL_ENTRY_SUBMITTED  — variables: {{shop_name}}, {{date}}, {{amount}}
 *   MSG91_TPL_ENTRY_APPROVED   — variables: {{shop_name}}, {{date}}, {{amount}}
 *   MSG91_TPL_ENTRY_REJECTED   — variables: {{shop_name}}, {{date}}, {{reason}}
 *   MSG91_TPL_DEADLINE_REMINDER— variables: {{shop_name}}
 */

const https = require('https');

const AUTH_KEY   = process.env.MSG91_AUTH_KEY;
const WA_NUMBER  = process.env.MSG91_WHATSAPP_NUMBER;   // e.g. 917XXXXXXXXXX
const ENABLED    = !!AUTH_KEY;

function normalizeMobile(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    return digits.startsWith('91') ? digits : `91${digits}`;
}

/* ── Low-level POST to MSG91 ─────────────────────────────────── */
function msg91Post(path, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req  = https.request(
            { hostname: 'api.msg91.com', path, method: 'POST',
              headers: { authkey: AUTH_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/* ── Send WhatsApp template message ─────────────────────────── */
async function sendWhatsApp(phone, templateName, variables = []) {
    if (!ENABLED || !WA_NUMBER || !phone) return;
    const to = normalizeMobile(phone);
    if (!to) return;

    try {
        const result = await msg91Post('/api/v5/whatsapp/whatsapp-outbound-message/', {
            integrated_number: WA_NUMBER,
            content_type: 'template',
            payload: {
                to,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'en' },
                    components: variables.length ? [{
                        type: 'body',
                        parameters: variables.map(v => ({ type: 'text', text: String(v) })),
                    }] : [],
                },
            },
        });
        console.log(`[MSG91 WA] → ${to} (${templateName}):`, result.status);
    } catch (err) {
        console.error(`[MSG91 WA] Error for ${phone}:`, err.message);
    }
}

/* ── Send SMS via MSG91 Flow ─────────────────────────────────── */
async function sendSMS(phone, message) {
    if (!ENABLED || !phone) return;
    const to = normalizeMobile(phone);
    if (!to) return;

    try {
        const result = await msg91Post('/api/v5/flow/', {
            sender: process.env.MSG91_SENDER_ID || 'SIZE24',
            route: '4',
            country: '91',
            sms: [{ message, to: [to] }],
        });
        console.log(`[MSG91 SMS] → ${to}:`, result.status);
    } catch (err) {
        console.error(`[MSG91 SMS] Error for ${phone}:`, err.message);
    }
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION HELPERS — call these from controllers
══════════════════════════════════════════════════════════════ */

/**
 * Notify admin/manager phones when a shop submits an entry.
 * Pass an array of admin/manager mobile numbers.
 */
async function notifyEntrySubmitted(adminPhones, shopName, date, amount) {
    const tpl = process.env.MSG91_TPL_ENTRY_SUBMITTED;
    if (!tpl) {
        console.log(`[MSG91] notifyEntrySubmitted: MSG91_TPL_ENTRY_SUBMITTED not set, skipping`);
        return;
    }
    for (const phone of adminPhones) {
        await sendWhatsApp(phone, tpl, [shopName, date, `Rs.${amount}`]);
    }
}

/** Notify shop user when their entry is approved. */
async function notifyEntryApproved(shopUserPhone, shopName, date, amount) {
    const tpl = process.env.MSG91_TPL_ENTRY_APPROVED;
    if (!tpl) {
        console.log(`[MSG91] notifyEntryApproved: MSG91_TPL_ENTRY_APPROVED not set, skipping`);
        return;
    }
    await sendWhatsApp(shopUserPhone, tpl, [shopName, date, `Rs.${amount}`]);
}

/** Notify shop user when their entry is rejected. */
async function notifyEntryRejected(shopUserPhone, shopName, date, reason) {
    const tpl = process.env.MSG91_TPL_ENTRY_REJECTED;
    if (!tpl) {
        console.log(`[MSG91] notifyEntryRejected: MSG91_TPL_ENTRY_REJECTED not set, skipping`);
        return;
    }
    await sendWhatsApp(shopUserPhone, tpl, [shopName, date, reason || 'No reason provided']);
}

/** Send deadline reminder to shops that haven't submitted yet. */
async function notifyDeadlineReminder(shopUserPhone, shopName) {
    const tpl = process.env.MSG91_TPL_DEADLINE_REMINDER;
    if (!tpl) {
        console.log(`[MSG91] notifyDeadlineReminder: MSG91_TPL_DEADLINE_REMINDER not set, skipping`);
        return;
    }
    await sendWhatsApp(shopUserPhone, tpl, [shopName]);
}

module.exports = {
    sendWhatsApp,
    sendSMS,
    notifyEntrySubmitted,
    notifyEntryApproved,
    notifyEntryRejected,
    notifyDeadlineReminder,
    isEnabled: () => ENABLED,
};
