import React from 'react';
import Layout from '../../components/Layout';
import EmployeeAttendanceCard from '../../components/attendance/EmployeeAttendanceCard';

// Self-service attendance for managers & admins (employees use the Shop Dashboard card).
export default function MyAttendancePage() {
    return (
        <Layout title="My Attendance">
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
                <EmployeeAttendanceCard />
            </div>
        </Layout>
    );
}
