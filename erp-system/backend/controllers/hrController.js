'use strict';
const db = require('../config/db');

async function nextEmpCode(client) {
    const { rows } = await client.query(`UPDATE inv_counters SET last_number=last_number+1 WHERE counter_name='emp_code' RETURNING last_number`);
    return `EMP-${String(rows[0].last_number).padStart(4,'0')}`;
}

/* ── Employees ─────────────────────────────────────────── */
exports.listEmployees = async (req, res) => {
    try {
        const { search, department, employment_type, is_active } = req.query;
        const params = [];
        let q = `SELECT * FROM hr_employees WHERE 1=1`;
        if (search) { params.push(`%${search}%`); q += ` AND (name ILIKE $${params.length} OR emp_code ILIKE $${params.length} OR mobile ILIKE $${params.length})`; }
        if (department) { params.push(department); q += ` AND department=$${params.length}`; }
        if (employment_type) { params.push(employment_type); q += ` AND employment_type=$${params.length}`; }
        if (is_active !== undefined) { params.push(is_active === 'true'); q += ` AND is_active=$${params.length}`; }
        q += ` ORDER BY name`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getEmployee = async (req, res) => {
    try {
        const { rows: [emp] } = await db.query(`SELECT * FROM hr_employees WHERE id=$1`, [req.params.id]);
        if (!emp) return res.status(404).json({ error: 'Not found' });
        const { rows: recent } = await db.query(
            `SELECT att_date, status FROM hr_attendance WHERE employee_id=$1 ORDER BY att_date DESC LIMIT 30`, [emp.id]
        );
        res.json({ ...emp, recent_attendance: recent });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createEmployee = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const emp_code = await nextEmpCode(client);
        const { name, mobile, email, dob, gender, address, department, designation, employment_type, joining_date, basic_salary, hra, da, pf_applicable, esi_applicable, bank_name, bank_account, ifsc, pan, aadhar } = req.body;
        const { rows: [emp] } = await client.query(
            `INSERT INTO hr_employees (emp_code,name,mobile,email,dob,gender,address,department,designation,employment_type,joining_date,basic_salary,hra,da,pf_applicable,esi_applicable,bank_name,bank_account,ifsc,pan,aadhar)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
            [emp_code,name,mobile,email,dob||null,gender,address,department,designation,employment_type||'full_time',joining_date||null,basic_salary||0,hra||0,da||0,pf_applicable||false,esi_applicable||false,bank_name,bank_account,ifsc,pan,aadhar]
        );
        await client.query('COMMIT');
        res.json(emp);
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
    finally { client.release(); }
};

exports.updateEmployee = async (req, res) => {
    try {
        const fields = ['name','mobile','email','dob','gender','address','department','designation','employment_type','joining_date','leaving_date','basic_salary','hra','da','pf_applicable','esi_applicable','bank_name','bank_account','ifsc','pan','aadhar','is_active'];
        const sets = []; const vals = [];
        for (const f of fields) {
            if (req.body[f] !== undefined) { vals.push(req.body[f]); sets.push(`${f}=$${vals.length}`); }
        }
        if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
        vals.push(req.params.id);
        const { rows: [emp] } = await db.query(`UPDATE hr_employees SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        res.json(emp);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Attendance ────────────────────────────────────────── */
exports.getAttendance = async (req, res) => {
    try {
        const { employee_id, month, from, to } = req.query;
        const params = [];
        let q = `SELECT a.*, e.name AS emp_name, e.emp_code FROM hr_attendance a JOIN hr_employees e ON e.id=a.employee_id WHERE 1=1`;
        if (employee_id) { params.push(employee_id); q += ` AND a.employee_id=$${params.length}`; }
        if (month) { params.push(`${month}-01`); q += ` AND DATE_TRUNC('month',a.att_date)=DATE_TRUNC('month',$${params.length}::date)`; }
        if (from) { params.push(from); q += ` AND a.att_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND a.att_date<=$${params.length}`; }
        q += ` ORDER BY a.att_date DESC, e.name LIMIT 500`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.markAttendance = async (req, res) => {
    try {
        const { records } = req.body; // [{employee_id, att_date, status, check_in, check_out, overtime_hours, notes}]
        const results = [];
        for (const r of records) {
            const { rows: [att] } = await db.query(
                `INSERT INTO hr_attendance (employee_id, att_date, status, check_in, check_out, overtime_hours, notes, marked_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (employee_id, att_date) DO UPDATE SET status=EXCLUDED.status, check_in=EXCLUDED.check_in, check_out=EXCLUDED.check_out, overtime_hours=EXCLUDED.overtime_hours, notes=EXCLUDED.notes, marked_by=EXCLUDED.marked_by
                 RETURNING *`,
                [r.employee_id, r.att_date, r.status, r.check_in||null, r.check_out||null, r.overtime_hours||0, r.notes||null, req.user.id]
            );
            results.push(att);
        }
        res.json({ saved: results.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Salary ────────────────────────────────────────────── */
exports.generateSalary = async (req, res) => {
    try {
        const { month, employee_ids } = req.body; // month = "YYYY-MM"
        const slipMonth = `${month}-01`;
        const { rows: emps } = employee_ids?.length
            ? await db.query(`SELECT * FROM hr_employees WHERE id=ANY($1::int[]) AND is_active=true`, [employee_ids])
            : await db.query(`SELECT * FROM hr_employees WHERE is_active=true AND employment_type NOT IN ('daily_wage','tailor')`);

        const slips = [];
        for (const emp of emps) {
            // Get attendance for month
            const { rows: att } = await db.query(
                `SELECT status, COUNT(*) AS cnt FROM hr_attendance WHERE employee_id=$1 AND DATE_TRUNC('month',att_date)=DATE_TRUNC('month',$2::date) GROUP BY status`,
                [emp.id, slipMonth]
            );
            const attMap = Object.fromEntries(att.map(a => [a.status, parseInt(a.cnt)]));
            const presentDays = (attMap.present||0) + (attMap.work_from_home||0) + (attMap.half_day||0)*0.5;
            const workingDays = 26; // standard working days
            const ratio = workingDays > 0 ? Math.min(1, presentDays / workingDays) : 0;

            const basic    = parseFloat(emp.basic_salary || 0) * ratio;
            const hra      = parseFloat(emp.hra || 0) * ratio;
            const da       = parseFloat(emp.da || 0) * ratio;
            const gross    = basic + hra + da;
            const pfDeduct = emp.pf_applicable  ? Math.min(basic * 0.12, 1800) : 0;
            const esiDeduct = emp.esi_applicable ? gross * 0.0075 : 0;
            const netPay   = gross - pfDeduct - esiDeduct;

            const { rows: [existing] } = await db.query(`SELECT id FROM hr_salary_slips WHERE employee_id=$1 AND slip_month=$2`, [emp.id, slipMonth]);
            if (!existing) {
                const { rows: [slip] } = await db.query(
                    `INSERT INTO hr_salary_slips (employee_id,slip_month,working_days,present_days,basic,hra,da,gross,pf_deduct,esi_deduct,net_pay,generated_by)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
                    [emp.id, slipMonth, workingDays, presentDays, basic.toFixed(2), hra.toFixed(2), da.toFixed(2), gross.toFixed(2), pfDeduct.toFixed(2), esiDeduct.toFixed(2), netPay.toFixed(2), req.user.id]
                );
                slips.push(slip);
            }
        }
        res.json({ generated: slips.length, slips });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSalarySlips = async (req, res) => {
    try {
        const { employee_id, month, status } = req.query;
        const params = [];
        let q = `SELECT ss.*, e.name AS emp_name, e.emp_code, e.department, e.designation
                 FROM hr_salary_slips ss JOIN hr_employees e ON e.id=ss.employee_id WHERE 1=1`;
        if (employee_id) { params.push(employee_id); q += ` AND ss.employee_id=$${params.length}`; }
        if (month) { params.push(`${month}-01`); q += ` AND ss.slip_month=$${params.length}`; }
        if (status) { params.push(status); q += ` AND ss.status=$${params.length}`; }
        q += ` ORDER BY ss.slip_month DESC, e.name`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.approveSalarySlip = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_mode, payment_date, incentive, advance_deduct, other_deduct, notes } = req.body;
        const { rows: [slip] } = await db.query(
            `UPDATE hr_salary_slips SET status='approved', payment_mode=$1, payment_date=$2,
             incentive=COALESCE($3,incentive), advance_deduct=COALESCE($4,advance_deduct), other_deduct=COALESCE($5,other_deduct),
             net_pay=gross + COALESCE($3,incentive) - pf_deduct - esi_deduct - tds_deduct - COALESCE($4,advance_deduct) - COALESCE($5,other_deduct) - other_deduct,
             notes=$6
             WHERE id=$7 RETURNING *`,
            [payment_mode, payment_date||null, incentive||null, advance_deduct||null, other_deduct||null, notes||null, id]
        );
        res.json(slip);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Leaves ────────────────────────────────────────────── */
exports.getLeaves = async (req, res) => {
    try {
        const { employee_id, status, from, to } = req.query;
        const params = [];
        let q = `SELECT l.*, e.name AS emp_name, e.emp_code, lt.name AS leave_type_name
                 FROM hr_leaves l
                 JOIN hr_employees e ON e.id=l.employee_id
                 LEFT JOIN hr_leave_types lt ON lt.id=l.leave_type_id
                 WHERE 1=1`;
        if (employee_id) { params.push(employee_id); q += ` AND l.employee_id=$${params.length}`; }
        if (status) { params.push(status); q += ` AND l.status=$${params.length}`; }
        if (from) { params.push(from); q += ` AND l.from_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND l.to_date<=$${params.length}`; }
        q += ` ORDER BY l.applied_at DESC`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.applyLeave = async (req, res) => {
    try {
        const { employee_id, leave_type_id, from_date, to_date, reason } = req.body;
        const days = Math.ceil((new Date(to_date) - new Date(from_date)) / (1000*60*60*24)) + 1;
        const { rows: [leave] } = await db.query(
            `INSERT INTO hr_leaves (employee_id,leave_type_id,from_date,to_date,days,reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [employee_id, leave_type_id||null, from_date, to_date, days, reason||null]
        );
        res.json(leave);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.approveLeave = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { rows: [leave] } = await db.query(
            `UPDATE hr_leaves SET status=$1, approved_by=$2 WHERE id=$3 RETURNING *`,
            [status, req.user.id, id]
        );
        res.json(leave);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Tailor Work ───────────────────────────────────────── */
exports.getTailorWork = async (req, res) => {
    try {
        const { employee_id, from, to, status } = req.query;
        const params = [];
        let q = `SELECT tw.*, e.name AS emp_name FROM hr_tailor_work tw JOIN hr_employees e ON e.id=tw.employee_id WHERE 1=1`;
        if (employee_id) { params.push(employee_id); q += ` AND tw.employee_id=$${params.length}`; }
        if (from) { params.push(from); q += ` AND tw.work_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND tw.work_date<=$${params.length}`; }
        if (status) { params.push(status); q += ` AND tw.status=$${params.length}`; }
        q += ` ORDER BY tw.work_date DESC`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.addTailorWork = async (req, res) => {
    try {
        const { employee_id, work_date, order_ref, item_desc, qty, rate_per_piece, notes } = req.body;
        const amount = parseFloat(qty||1) * parseFloat(rate_per_piece||0);
        const { rows: [w] } = await db.query(
            `INSERT INTO hr_tailor_work (employee_id,work_date,order_ref,item_desc,qty,rate_per_piece,amount,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [employee_id, work_date, order_ref||null, item_desc, qty||1, rate_per_piece||0, amount, notes||null]
        );
        res.json(w);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.markTailorPaid = async (req, res) => {
    try {
        const { ids, paid_date } = req.body;
        await db.query(`UPDATE hr_tailor_work SET status='paid', paid_date=$1 WHERE id=ANY($2::int[])`, [paid_date||new Date().toISOString().split('T')[0], ids]);
        res.json({ updated: ids.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── HR Dashboard Stats ────────────────────────────────── */
exports.getHRStats = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [{ rows: [emps] }, { rows: att }, { rows: [leaves] }, { rows: [tailor] }] = await Promise.all([
            db.query(`SELECT COUNT(*) AS total, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS active FROM hr_employees`),
            db.query(`SELECT status, COUNT(*) AS cnt FROM hr_attendance WHERE att_date=$1 GROUP BY status`, [today]),
            db.query(`SELECT COUNT(*) AS pending FROM hr_leaves WHERE status='pending'`),
            db.query(`SELECT COALESCE(SUM(amount),0) AS pending_pay FROM hr_tailor_work WHERE status='pending'`),
        ]);
        const attMap = Object.fromEntries(att.map(a => [a.status, parseInt(a.cnt)]));
        res.json({ employees: emps, attendance_today: attMap, leaves_pending: leaves.pending, tailor_pending_pay: tailor.pending_pay });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
