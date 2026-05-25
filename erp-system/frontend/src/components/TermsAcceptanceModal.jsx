import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';

const TermsAcceptanceModal = ({ onAccepted }) => {
    const [checked,    setChecked]    = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error,      setError]      = useState('');

    const handleAccept = async () => {
        if (!checked) return;
        setSubmitting(true);
        setError('');
        try {
            await api.post('/auth/accept-terms');
            onAccepted();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save acceptance. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            style={{ backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-white">

                {/* Header */}
                <div className="px-6 py-5 flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg,#FF6B00,#c2410c)' }}>
                    <div className="p-2 rounded-xl bg-white/20">
                        <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-white">Terms &amp; Privacy Acceptance</h2>
                        <p className="text-xs text-white/80 mt-0.5">Required before you can continue</p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm text-gray-700">
                        Welcome to <strong>ShopSize24 ERP</strong>. Before you proceed, please review and accept our Terms &amp; Conditions and Privacy Policy.
                    </p>

                    {/* Summary bullets */}
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2">
                        {[
                            'This software is the exclusive property of ShopSize24.',
                            'Unauthorized copying, resale, or reverse engineering is prohibited.',
                            'Your activity, login, and business data are logged for security.',
                            'Your data is protected under Indian IT and Privacy laws.',
                        ].map((point, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-orange-800">{point}</p>
                            </div>
                        ))}
                    </div>

                    {/* Links */}
                    <div className="flex gap-4">
                        <Link to="/terms" target="_blank" rel="noreferrer"
                            className="flex-1 text-center py-2.5 text-xs font-semibold rounded-xl border-2 border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors">
                            📄 Terms &amp; Conditions
                        </Link>
                        <Link to="/privacy" target="_blank" rel="noreferrer"
                            className="flex-1 text-center py-2.5 text-xs font-semibold rounded-xl border-2 border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors">
                            🔒 Privacy Policy
                        </Link>
                    </div>

                    {/* Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setChecked(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded accent-orange-500 cursor-pointer flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700">
                            I have read and agree to the{' '}
                            <Link to="/terms" target="_blank" className="text-orange-600 hover:underline font-medium">Terms &amp; Conditions</Link>
                            {' '}and{' '}
                            <Link to="/privacy" target="_blank" className="text-orange-600 hover:underline font-medium">Privacy Policy</Link>
                            {' '}of ShopSize24 ERP.
                        </span>
                    </label>

                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        onClick={handleAccept}
                        disabled={!checked || submitting}
                        className="w-full py-3 text-sm font-bold rounded-xl text-white transition-all flex items-center justify-center gap-2"
                        style={{ background: (!checked || submitting) ? '#9ca3af' : 'linear-gradient(135deg,#FF6B00,#c2410c)', boxShadow: (checked && !submitting) ? '0 4px 14px rgba(255,107,0,0.4)' : 'none' }}>
                        {submitting
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                            : <><CheckCircle2 className="h-4 w-4" /> I Accept &amp; Continue</>}
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-3">
                        Acceptance timestamp is recorded for compliance purposes.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TermsAcceptanceModal;
