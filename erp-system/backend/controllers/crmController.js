'use strict';
const db = require('../config/db');

async function nextCounter(name, prefix, pad = 5) {
    const { rows } = await db.query(`UPDATE inv_counters SET last_number=last_number+1 WHERE counter_name=$1 RETURNING last_number`, [name]);
    return `${prefix}-${String(rows[0].last_number).padStart(pad,'0')}`;
}

/* ── Leads ─────────────────────────────────────────────── */
exports.getLeads = async (req, res) => {
    try {
        const { status, assigned_to, search, from, to, page = 1 } = req.query;
        const offset = (page - 1) * 50;
        const params = [];
        let q = `SELECT l.*, u.name AS assigned_name FROM crm_leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE 1=1`;
        if (status) { params.push(status); q += ` AND l.status=$${params.length}`; }
        if (assigned_to) { params.push(assigned_to); q += ` AND l.assigned_to=$${params.length}`; }
        if (search) { params.push(`%${search}%`); q += ` AND (l.name ILIKE $${params.length} OR l.mobile ILIKE $${params.length} OR l.school_name ILIKE $${params.length})`; }
        if (from) { params.push(from); q += ` AND l.created_at::date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND l.created_at::date<=$${params.length}`; }
        q += ` ORDER BY l.created_at DESC LIMIT 50 OFFSET ${offset}`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getLead = async (req, res) => {
    try {
        const { id } = req.params;
        const [{ rows: [lead] }, { rows: followups }, { rows: calls }, { rows: tasks }, { rows: quotes }] = await Promise.all([
            db.query(`SELECT l.*, u.name AS assigned_name FROM crm_leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.id=$1`, [id]),
            db.query(`SELECT f.*, u.name AS done_by_name FROM crm_followups f LEFT JOIN users u ON u.id=f.done_by WHERE f.lead_id=$1 ORDER BY f.followup_date DESC`, [id]),
            db.query(`SELECT c.*, u.name AS done_by_name FROM crm_calls c LEFT JOIN users u ON u.id=c.done_by WHERE c.lead_id=$1 ORDER BY c.call_date DESC`, [id]),
            db.query(`SELECT t.*, u.name AS assigned_name FROM crm_tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE t.lead_id=$1 ORDER BY t.due_date`, [id]),
            db.query(`SELECT * FROM crm_quotations WHERE lead_id=$1 ORDER BY quote_date DESC`, [id]),
        ]);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        res.json({ ...lead, followups, calls, tasks, quotes });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createLead = async (req, res) => {
    try {
        const lead_number = await nextCounter('lead_number', 'LEAD');
        const { name, mobile, email, address, school_name, source, category, assigned_to, expected_value, expected_date, notes } = req.body;
        const { rows: [lead] } = await db.query(
            `INSERT INTO crm_leads (lead_number,name,mobile,email,address,school_name,source,category,assigned_to,expected_value,expected_date,notes,created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [lead_number,name,mobile,email||null,address||null,school_name||null,source||null,category||null,assigned_to||null,expected_value||null,expected_date||null,notes||null,req.user.id]
        );
        res.json(lead);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateLead = async (req, res) => {
    try {
        const fields = ['name','mobile','email','address','school_name','source','category','assigned_to','status','expected_value','expected_date','lost_reason','notes'];
        const sets = []; const vals = [];
        for (const f of fields) {
            if (req.body[f] !== undefined) { vals.push(req.body[f]); sets.push(`${f}=$${vals.length}`); }
        }
        vals.push('NOW()'); sets.push(`updated_at=$${vals.length}`);
        vals.push(req.params.id);
        const { rows: [lead] } = await db.query(`UPDATE crm_leads SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        res.json(lead);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.convertLead = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { rows: [lead] } = await client.query(`SELECT * FROM crm_leads WHERE id=$1`, [id]);
        if (!lead) throw new Error('Lead not found');
        // Create customer if not exists
        let customerId = lead.customer_id;
        if (!customerId) {
            const { rows: [cust] } = await client.query(
                `INSERT INTO inv_customers (name, mobile, email, notes) VALUES ($1,$2,$3,$4) RETURNING id`,
                [lead.name, lead.mobile, lead.email, `Converted from CRM Lead ${lead.lead_number}`]
            );
            customerId = cust.id;
        }
        await client.query(`UPDATE crm_leads SET is_converted=true, customer_id=$1, status='won', updated_at=NOW() WHERE id=$2`, [customerId, id]);
        await client.query('COMMIT');
        res.json({ customer_id: customerId });
    } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
    finally { client.release(); }
};

/* ── Followups ─────────────────────────────────────────── */
exports.getFollowups = async (req, res) => {
    try {
        const { lead_id, from, to, assigned_to } = req.query;
        const params = [];
        let q = `SELECT f.*, l.name AS lead_name, l.mobile, u.name AS done_by_name FROM crm_followups f JOIN crm_leads l ON l.id=f.lead_id LEFT JOIN users u ON u.id=f.done_by WHERE 1=1`;
        if (lead_id) { params.push(lead_id); q += ` AND f.lead_id=$${params.length}`; }
        if (from) { params.push(from); q += ` AND f.followup_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND f.followup_date<=$${params.length}`; }
        if (assigned_to) { params.push(assigned_to); q += ` AND l.assigned_to=$${params.length}`; }
        q += ` ORDER BY f.followup_date DESC LIMIT 200`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.addFollowup = async (req, res) => {
    try {
        const { lead_id, followup_date, followup_type, notes, outcome, next_followup } = req.body;
        const { rows: [f] } = await db.query(
            `INSERT INTO crm_followups (lead_id,followup_date,followup_type,notes,outcome,next_followup,done_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [lead_id, followup_date, followup_type||'call', notes||null, outcome||null, next_followup||null, req.user.id]
        );
        if (next_followup) {
            await db.query(`UPDATE crm_leads SET updated_at=NOW() WHERE id=$1`, [lead_id]);
        }
        res.json(f);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Quotations ────────────────────────────────────────── */
exports.getQuotations = async (req, res) => {
    try {
        const { lead_id, customer_id, status } = req.query;
        const params = [];
        let q = `SELECT q.*, l.name AS lead_name, u.name AS created_by_name FROM crm_quotations q LEFT JOIN crm_leads l ON l.id=q.lead_id LEFT JOIN users u ON u.id=q.created_by WHERE 1=1`;
        if (lead_id) { params.push(lead_id); q += ` AND q.lead_id=$${params.length}`; }
        if (customer_id) { params.push(customer_id); q += ` AND q.customer_id=$${params.length}`; }
        if (status) { params.push(status); q += ` AND q.status=$${params.length}`; }
        q += ` ORDER BY q.quote_date DESC LIMIT 100`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createQuotation = async (req, res) => {
    try {
        const quote_number = await nextCounter('quote_number', 'QT');
        const { lead_id, customer_id, quote_date, valid_till, items, subtotal, discount, gst, total, notes } = req.body;
        const { rows: [q] } = await db.query(
            `INSERT INTO crm_quotations (quote_number,lead_id,customer_id,quote_date,valid_till,items,subtotal,discount,gst,total,notes,created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [quote_number,lead_id||null,customer_id||null,quote_date,valid_till||null,JSON.stringify(items||[]),subtotal||0,discount||0,gst||0,total||0,notes||null,req.user.id]
        );
        res.json(q);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateQuotationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { rows: [q] } = await db.query(`UPDATE crm_quotations SET status=$1 WHERE id=$2 RETURNING *`, [status, id]);
        res.json(q);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Tasks ─────────────────────────────────────────────── */
exports.getTasks = async (req, res) => {
    try {
        const { assigned_to, status, priority, from, to } = req.query;
        const params = [];
        let q = `SELECT t.*, u.name AS assigned_name, l.name AS lead_name FROM crm_tasks t LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN crm_leads l ON l.id=t.lead_id WHERE 1=1`;
        const uid = assigned_to || (req.query.my === 'true' ? req.user.id : null);
        if (uid) { params.push(uid); q += ` AND t.assigned_to=$${params.length}`; }
        if (status) { params.push(status); q += ` AND t.status=$${params.length}`; }
        if (priority) { params.push(priority); q += ` AND t.priority=$${params.length}`; }
        if (from) { params.push(from); q += ` AND t.due_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND t.due_date<=$${params.length}`; }
        q += ` ORDER BY t.due_date, t.priority DESC`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createTask = async (req, res) => {
    try {
        const { title, lead_id, customer_id, assigned_to, due_date, priority, notes } = req.body;
        const { rows: [task] } = await db.query(
            `INSERT INTO crm_tasks (title,lead_id,customer_id,assigned_to,due_date,priority,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [title,lead_id||null,customer_id||null,assigned_to||null,due_date||null,priority||'medium',notes||null,req.user.id]
        );
        res.json(task);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const { rows: [task] } = await db.query(`UPDATE crm_tasks SET status=$1, notes=COALESCE($2,notes) WHERE id=$3 RETURNING *`, [status, notes||null, id]);
        res.json(task);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── CRM Dashboard ─────────────────────────────────────── */
exports.getCRMDashboard = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [{ rows: pipeline }, { rows: [tasks] }, { rows: followups }, { rows: [topUser] }] = await Promise.all([
            db.query(`SELECT status, COUNT(*) AS cnt, COALESCE(SUM(expected_value),0) AS value FROM crm_leads GROUP BY status ORDER BY status`),
            db.query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM crm_tasks WHERE assigned_to=$1`, [req.user.id]),
            db.query(`SELECT * FROM crm_followups f JOIN crm_leads l ON l.id=f.lead_id WHERE f.followup_date=$1 AND l.assigned_to=$2 ORDER BY f.followup_date`, [today, req.user.id]),
            db.query(`SELECT assigned_to, u.name, COUNT(*) AS won FROM crm_leads l JOIN users u ON u.id=l.assigned_to WHERE l.status='won' GROUP BY l.assigned_to, u.name ORDER BY won DESC LIMIT 1`),
        ]);
        res.json({ pipeline, my_tasks: tasks, today_followups: followups, top_performer: topUser });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Birthday Reminders ─────────────────────────────────── */
exports.getBirthdayReminders = async (req, res) => {
    try {
        const today = new Date();
        const mmdd = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const { rows } = await db.query(
            `SELECT id, name, mobile, email, dob FROM inv_customers
             WHERE TO_CHAR(dob,'MM-DD')=$1 AND dob IS NOT NULL
             UNION
             SELECT e.id+10000 AS id, e.name, e.mobile, e.email, e.dob FROM hr_employees e
             WHERE TO_CHAR(e.dob,'MM-DD')=$1 AND e.dob IS NOT NULL
             ORDER BY name`,
            [mmdd]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
