import React, { useState } from 'react';
import { MapPin, Loader2, CheckCircle2, AlertCircle, ShieldCheck, X } from 'lucide-react';
import SelfieCapture from './SelfieCapture';
import { getPosition, buildFormData, attApi } from './attendanceUtils';

/**
 * First-time registration OR location-change request.
 * mode='register' -> POST /attendance/register
 * mode='location' -> POST /attendance/location-change
 */
const CompleteRegistrationModal = ({ mode = 'register', onClose, onDone }) => {
    const isLoc = mode === 'location';
    const [selfie, setSelfie] = useState(null);
    const [gps, setGps]       = useState(null);
    const [gpsBusy, setGpsBusy] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError]   = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone]     = useState(false);

    const captureGps = async () => {
        setGpsBusy(true); setError('');
        try { setGps(await getPosition()); }
        catch (e) { setError(e.message); }
        finally { setGpsBusy(false); }
    };

    const submit = async () => {
        if (!gps) return setError('Please capture your GPS location.');
        if (!selfie) return setError('Please take a selfie.');
        setSubmitting(true); setError('');
        try {
            const fd = buildFormData({
                selfie, latitude: gps.latitude, longitude: gps.longitude,
                accuracy: gps.accuracy, extra: isLoc ? { reason } : {},
            });
            await attApi.post(isLoc ? '/attendance/location-change' : '/attendance/register', fd,
                { headers: { 'Content-Type': 'multipart/form-data' } });
            setDone(true);
            setTimeout(() => { onDone?.(); onClose?.(); }, 1800);
        } catch (err) {
            setError(err.response?.data?.error || 'Submission failed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
                style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-teal-700" />
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                            {isLoc ? 'Request Location Change' : 'Complete Registration'}
                        </h3>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200"
                            style={{ color: 'var(--text-secondary)' }}><X className="h-5 w-5" /></button>
                    )}
                </div>

                {done ? (
                    <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
                        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                        <p className="text-base font-semibold text-emerald-700">
                            {isLoc ? 'Location change submitted!' : 'Registration submitted!'}
                        </p>
                        <p className="text-sm text-gray-500">Waiting for admin approval.</p>
                    </div>
                ) : (
                    <div className="px-6 py-5 space-y-5">
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {isLoc
                                ? 'Capture your new office GPS and a fresh selfie. Your old location stays active until admin approves.'
                                : 'We need your GPS location and a selfie to register your office location. Your account activates after admin approval.'}
                        </p>

                        {/* Step 1: GPS */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
                                1 · GPS Location
                            </p>
                            <button type="button" onClick={captureGps} disabled={gpsBusy}
                                className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 border transition-colors ${
                                    gps ? 'bg-green-50 border-green-300 text-green-700'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                {gpsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                                {gps ? 'Location Captured ✓' : 'Capture My Location'}
                            </button>
                            {gps && (
                                <p className="mt-1.5 text-[11px] text-gray-500">
                                    {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)} · accuracy ±{Math.round(gps.accuracy)}m
                                    {gps.accuracy > 20 && <span className="text-amber-600 font-semibold"> — move to open area for better accuracy</span>}
                                </p>
                            )}
                        </div>

                        {/* Step 2: Selfie */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
                                2 · Selfie
                            </p>
                            <SelfieCapture onCapture={setSelfie} />
                        </div>

                        {isLoc && (
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Reason (optional)
                                </label>
                                <input value={reason} onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Shop relocated"
                                    className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                            </div>
                        )}

                        <button type="button" onClick={submit} disabled={submitting || !gps || !selfie}
                            className="w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:bg-gray-300"
                            style={{ background: (submitting || !gps || !selfie) ? undefined : '#0f766e' }}>
                            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : 'Submit for Approval'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompleteRegistrationModal;
