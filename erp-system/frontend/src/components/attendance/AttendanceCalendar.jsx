import React from 'react';

// Month grid that colours each day by attendance status.
const COLORS = {
    present:  '#16a34a',
    late:     '#d97706',
    half_day: '#ea580c',
    absent:   '#dc2626',
};

const AttendanceCalendar = ({ month, days = [] }) => {
    const [yy, mm] = (month || new Date().toISOString().slice(0, 7)).split('-').map(Number);
    const first = new Date(yy, mm - 1, 1);
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const startWeekday = first.getDay(); // 0=Sun
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === yy && today.getMonth() + 1 === mm;

    // Map date -> status
    const byDate = {};
    days.forEach((d) => {
        const key = String(d.date).split('T')[0];
        byDate[key] = d.attendance_status || 'present';
    });

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
        const key = `${yy}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const past = !isCurrentMonth || d <= today.getDate();
        let status = byDate[key];
        if (!status && past && new Date(yy, mm - 1, d).getDay() !== 0) status = 'absent';
        cells.push({ day: d, status, isToday: isCurrentMonth && d === today.getDate() });
    }

    return (
        <div>
            <div className="grid grid-cols-7 gap-1 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-gray-400">{w}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {cells.map((c, i) => c === null ? <div key={i} /> : (
                    <div key={i}
                        className="aspect-square rounded-md flex items-center justify-center text-[11px] font-semibold relative"
                        style={{
                            background: c.status ? COLORS[c.status] + '22' : 'var(--bg-primary)',
                            color: c.status ? COLORS[c.status] : 'var(--text-secondary)',
                            border: c.isToday ? '2px solid #0f766e' : '1px solid var(--border-color)',
                        }}
                        title={c.status ? c.status.replace('_', ' ') : ''}>
                        {c.day}
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
                {Object.entries(COLORS).map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: v }} />
                        {k.replace('_', ' ')}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default AttendanceCalendar;
