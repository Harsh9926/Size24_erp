import React, { useState, useEffect } from 'react';
import { Settings, Plus, Save, RefreshCw, CheckCircle2, AlertCircle, X, Building2, Bell } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';
const TABS = ['General Settings','Branches','Notification Templates'];

export default function SettingsPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState('General Settings');
    const [toast, setToast] = useState(null);
    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    const [settings, setSettings] = useState([]);
    const [settingsMap, setSettingsMap] = useState({});
    const [branches, setBranches] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [showBranchForm, setShowBranchForm] = useState(false);
    const [branchForm, setBranchForm] = useState({ name:'', code:'', address:'', city:'', state:'', pincode:'', mobile:'', email:'', gstin:'' });
    const [showTplForm, setShowTplForm] = useState(false);
    const [tplForm, setTplForm] = useState({ channel:'whatsapp', event_type:'', template_text:'', is_active:true });

    const load = async () => {
        setLoading(true);
        try {
            if (tab === 'General Settings') {
                const r = await api.get('/sys/settings');
                setSettings(r.data);
                const m = {};
                r.data.forEach(s => { m[s.setting_key] = s.setting_value; });
                setSettingsMap(m);
            } else if (tab === 'Branches') {
                const r = await api.get('/sys/branches');
                setBranches(r.data);
            } else {
                const r = await api.get('/sys/notification-templates');
                setTemplates(r.data);
            }
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [tab]);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const updates = settings.map(s => ({ key: s.setting_key, value: settingsMap[s.setting_key] ?? s.setting_value }));
            await Promise.all(updates.map(u => api.put(`/sys/settings/${u.key}`, { value: u.value })));
            showMsg('Settings saved');
        } catch (e) { showMsg('Failed to save','error'); }
        finally { setSaving(false); }
    };

    const handleCreateBranch = async () => {
        try {
            await api.post('/sys/branches', branchForm);
            showMsg('Branch created'); setShowBranchForm(false); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleSaveTpl = async () => {
        try {
            await api.post('/sys/notification-templates', tplForm);
            showMsg('Template saved'); setShowTplForm(false); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const SETTING_GROUPS = {
        company: settings.filter(s => s.setting_key.startsWith('company_')),
        gst:     settings.filter(s => s.setting_key.startsWith('gst_') || s.setting_key.startsWith('default_gst')),
        invoice: settings.filter(s => s.setting_key.includes('invoice') || s.setting_key.includes('prefix')),
        other:   settings.filter(s => !s.setting_key.startsWith('company_') && !s.setting_key.startsWith('gst_') && !s.setting_key.startsWith('default_gst') && !s.setting_key.includes('invoice') && !s.setting_key.includes('prefix')),
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                    </button>
                    <Settings className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>System Settings</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                    {tab === 'General Settings' && (
                        <button onClick={handleSaveSettings} disabled={saving} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                            <Save className="h-4 w-4" /> {saving?'Saving…':'Save Settings'}
                        </button>
                    )}
                    {tab === 'Branches' && (
                        <button onClick={() => setShowBranchForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                            <Plus className="h-4 w-4" /> Add Branch
                        </button>
                    )}
                    {tab === 'Notification Templates' && (
                        <button onClick={() => setShowTplForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                            <Plus className="h-4 w-4" /> Add Template
                        </button>
                    )}
                </header>

                <div className="flex gap-1 px-4 py-3 border-b overflow-x-auto flex-shrink-0" style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)' }}>
                    {TABS.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${tab===t?'text-white':'border'}`}
                            style={tab===t?{background:ORANGE}:{borderColor:'var(--border-color)',background:'var(--bg-primary)',color:'var(--text-secondary)'}}>
                            {t}
                        </button>
                    ))}
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                    {tab === 'General Settings' && (
                        <>
                            {Object.entries(SETTING_GROUPS).map(([group, items]) => items.length > 0 && (
                                <div key={group} className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                    <div className="px-5 py-3 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>{group}</p>
                                    </div>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {items.map(s => (
                                            <div key={s.setting_key}>
                                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>
                                                    {s.setting_key.replace(/_/g,' ')}
                                                    {s.description && <span className="ml-1 font-normal normal-case text-gray-400">— {s.description}</span>}
                                                </label>
                                                <input value={settingsMap[s.setting_key]??''} onChange={e=>setSettingsMap(m=>({...m,[s.setting_key]:e.target.value}))} className={iCls} style={inp} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {tab === 'Branches' && (
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <table className="w-full text-sm">
                                <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                    {['Code','Name','City','State','Mobile','GSTIN','Status'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {branches.map(b => (
                                        <tr key={b.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{b.code}</td>
                                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{b.name}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{b.city||'—'}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{b.state||'—'}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{b.mobile||'—'}</td>
                                            <td className="px-3 py-2.5 text-xs font-mono" style={{ color:'var(--text-secondary)' }}>{b.gstin||'—'}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.is_active?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                                                    {b.is_active?'Active':'Inactive'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && branches.length === 0 && (
                                        <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No branches configured</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'Notification Templates' && (
                        <div className="space-y-3">
                            {templates.map(t => (
                                <div key={t.id} className="rounded-2xl border p-4" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                                style={{ background: t.channel==='whatsapp'?'#25D366':t.channel==='sms'?'#3b82f6':t.channel==='email'?'#6366f1':'#8b5cf6' }}>
                                                {t.channel?.toUpperCase()}
                                            </span>
                                            <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{t.event_type?.replace(/_/g,' ')}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.is_active?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                                            {t.is_active?'Active':'Inactive'}
                                        </span>
                                    </div>
                                    <p className="text-xs p-2 rounded-lg" style={{ background:'var(--bg-primary)', color:'var(--text-secondary)', fontFamily:'monospace' }}>{t.template_text}</p>
                                </div>
                            ))}
                            {!loading && templates.length === 0 && (
                                <p className="text-center py-8 text-sm" style={{ color:'var(--text-secondary)' }}>No notification templates. Add one to get started.</p>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {showBranchForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Add Branch</h3>
                            <button onClick={() => setShowBranchForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
                            {[['name','Branch Name'],['code','Code'],['city','City'],['state','State'],['mobile','Mobile'],['email','Email'],['pincode','Pincode'],['gstin','GSTIN'],['address','Address']].map(([k,l]) => (
                                <div key={k} className={k==='address'?'col-span-2':''}>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    <input value={branchForm[k]} onChange={e=>setBranchForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} />
                                </div>
                            ))}
                            <div className="col-span-2 flex gap-3">
                                <button onClick={() => setShowBranchForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleCreateBranch} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Create Branch</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTplForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Notification Template</h3>
                            <button onClick={() => setShowTplForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Channel</label>
                                <select value={tplForm.channel} onChange={e=>setTplForm(f=>({...f,channel:e.target.value}))} className={iCls} style={inp}>
                                    {['whatsapp','sms','email','in_app'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Event Type</label>
                                <input value={tplForm.event_type} onChange={e=>setTplForm(f=>({...f,event_type:e.target.value}))} placeholder="e.g. invoice_created" className={iCls} style={inp} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Template Text</label>
                                <textarea value={tplForm.template_text} onChange={e=>setTplForm(f=>({...f,template_text:e.target.value}))} rows={4} placeholder="Use {variable} for dynamic values" className={iCls+' resize-none'} style={inp} />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowTplForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleSaveTpl} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Save Template</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold ${toast.type==='error'?'bg-red-600':'bg-emerald-600'} text-white`}>
                    {toast.type==='error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
