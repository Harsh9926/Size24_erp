import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const SignupPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', mobile: '', password: '', role: 'shop_user' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccess('');
        try {
            await api.post('/auth/register', form);
            setSuccess('Account created! Admin approval required before you can login.');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally { setLoading(false); }
    };

    const inputCls = "w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-sm transition-all focus:border-orange-400";

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ background: '#1E1E2F' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                {/* Logo & Brand */}
                <div className="flex flex-col items-center mb-7">
                    <img src="/logo.png" alt="SIZE24" className="h-14 w-auto object-contain mb-3" />
                    <h2 className="text-2xl font-extrabold text-gray-900">Create Account</h2>
                    <p className="text-gray-500 text-sm mt-0.5">Join SIZE24 ERP – Smart Retail System</p>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
                {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm font-medium">{success}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                        <input type="text" className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                        <input type="text" className={inputCls} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="Mobile number" required />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                        <input type="password" className={inputCls} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Create a password" required />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                        <select className={inputCls + ' bg-white'} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="shop_user">Shop User</option>
                        </select>
                    </div>
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        ⚠ Non-admin accounts require Admin approval before login.
                    </p>
                    <button type="submit" disabled={loading}
                        className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-60 mt-2"
                        style={{ backgroundColor: '#FF6B00' }}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="font-bold hover:underline" style={{ color: '#FF6B00' }}>Sign In</Link>
                </p>
                <p className="text-center text-xs text-gray-400 mt-5">Powered by <span className="font-bold" style={{ color: '#FF6B00' }}>SIZE24</span></p>
            </div>
        </div>
    );
};

export default SignupPage;
