import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { Loader2, CheckCircle2, XCircle, MapPin, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { mediaUrl, fmtDate } from '../../components/attendance/attendanceUtils';
import LocationMap from '../../components/attendance/LocationMap';
import { usePermissions } from '../../context/PermissionsContext';

export default function AttendanceApprovalsPage() {
    const [tab, setTab] = useState('registrations');
    const [regs, setRegs] = useState([]);
    const [locs, setLocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [toast, setToast] = useState(null);

    const show = (text, type = 'success') => { setToast({ text, type }); setTimeout(() => setToast(null), 2500); };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [r, l] = await Promise.all([
                api.get('/attendance/registrations/pending'),
                api.get('/attendance/location-changes/pending'),
            ]);
            setRegs(r.data); setLocs(l.data);
        } catch {} finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const act = async (url, id, okMsg) => {
        setBusyId(id);
        try { await api.put(url); show(okMsg); await load(); }
        catch (e) { show(e.response?.data?.error || 'Action failed', 'error'); }
        finally { setBusyId(null); }
    };
    const reject = async (url, id, kind) => {
        const reason = window.prompt(`Reason for rejecting this ${kind}?`) || undefined;
        setBusyId(id);
        try { await api.put(url, { reason }); show('Rejected'); await load(); }
        catch (e) { show(e.response?.data?.error || 'Action failed', 'error'); }
        finally { setBusyId(null); }
    };

    return (
        <Layout title="Attendance Approvals">
            <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                    {[['registrations', `Registrations (${regs.length})`], ['locations', `Location Changes (${locs.length})`]].map(([k, label]) => (
                        <button key={k} onClick={() => setTab(k)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === k ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {label}
                        </button>
                    ))}
                    <button onClick={load} className="ml-auto p-2 text-teal-700 hover:text-teal-800"><RefreshCw className="h-4 w-4" /></button>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
                ) : tab === 'registrations' ? (
                    regs.length === 0 ? <Empty text="No pending registrations." /> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {regs.map(r => (
                                <ApprovalCard key={r.id}
                                    title={r.name || r.mobile} subtitle={`${(r.role || '').replace('_', ' ')} · ${r.shop_name || 'No shop'}`}
                                    selfie={r.selfie_url} lat={r.latitude} lng={r.longitude} accuracy={r.gps_accuracy_m} when={r.created_at}
                                    busy={busyId === r.id}
                                    onApprove={() => act(`/attendance/registrations/${r.id}/approve`, r.id, 'Registration approved & user activated')}
                                    onReject={() => reject(`/attendance/registrations/${r.id}/reject`, r.id, 'registration')} />
                            ))}
                        </div>
                    )
                ) : (
                    locs.length === 0 ? <Empty text="No pending location changes." /> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {locs.map(l => (
                                <ApprovalCard key={l.id}
                                    title={l.name || l.mobile} subtitle={`${(l.role || '').replace('_', ' ')}${l.reason ? ` · ${l.reason}` : ''}`}
                                    selfie={l.selfie_url} lat={l.latitude} lng={l.longitude} accuracy={l.gps_accuracy_m} when={l.created_at}
                                    busy={busyId === l.id}
                                    onApprove={() => act(`/attendance/location-changes/${l.id}/approve`, l.id, 'Location change approved')}
                                    onReject={() => reject(`/attendance/location-changes/${l.id}/reject`, l.id, 'location change')} />
                            ))}
                        </div>
                    )
                )}
            </div>

            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-semibold text-white shadow-lg flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
                    {toast.type === 'error' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {toast.text}
                </div>
            )}
        </Layout>
    );
}

const Empty = ({ text }) => (
    <div className="rounded-xl border py-16 text-center text-gray-400" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" /> {text}
    </div>
);

function ApprovalCard({ title, subtitle, selfie, lat, lng, accuracy, when, busy, onApprove, onReject }) {
    const { can } = usePermissions();
    const canApprove = can('attendance_approvals.approve');
    const canReject  = can('attendance_approvals.reject');
    return (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <div className="p-4 flex gap-4">
                {selfie ? (
                    <img src={mediaUrl(selfie)} alt="selfie" className="h-24 w-20 rounded-lg object-cover border flex-shrink-0" />
                ) : <div className="h-24 w-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No selfie</div>}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                    <p className="text-xs capitalize mb-1" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{lat != null ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'No GPS'}</p>
                    <p className="text-[11px] text-gray-500">Accuracy: {accuracy != null ? `±${Math.round(accuracy)}m` : '—'}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(when)}</p>
                </div>
            </div>
            <div className="px-4 pb-3"><LocationMap lat={lat} lng={lng} height={140} /></div>
            {(canApprove || canReject) && (
            <div className="flex border-t" style={{ borderColor: 'var(--border-color)' }}>
                {canApprove && (
                <button onClick={onApprove} disabled={busy}
                    className="flex-1 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
                </button>
                )}
                {canReject && (
                <button onClick={onReject} disabled={busy}
                    className="flex-1 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 border-l disabled:opacity-50"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <XCircle className="h-4 w-4" /> Reject
                </button>
                )}
            </div>
            )}
        </div>
    );
}
