import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Plus, PlusCircle, Trash2, AlertTriangle, Loader2, Eye, EyeOff, MapPin, Edit, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

const EMPTY_SHOP = {
    state_id: '', city_id: '', shop_name: '', gst_number: '',
    shop_address: '', manager_name: '', mobile_number: '',
    document_type: 'aadhaar', document_number: '', user_id: '',
    latitude: '', longitude: '', geofence_radius_m: 50,
};

const EditShopModal = ({ shop, states, allCities, users, onSave, onCancel, saving }) => {
    const [form, setForm] = useState({
        state_id: shop.state_id || '',
        city_id: shop.city_id || '',
        shop_name: shop.shop_name || '',
        gst_number: shop.gst_number || '',
        shop_address: shop.shop_address || '',
        manager_name: shop.manager_name || '',
        mobile_number: shop.mobile_number || '',
        document_type: shop.document_type || 'aadhaar',
        document_number: shop.document_number || '',
        user_id: shop.user_id || '',
        latitude: shop.latitude != null ? shop.latitude : '',
        longitude: shop.longitude != null ? shop.longitude : '',
        geofence_radius_m: shop.geofence_radius_m != null ? shop.geofence_radius_m : 50,
    });
    const [fetchingGps, setFetchingGps] = useState(false);

    const filteredCities = allCities.filter(c => String(c.state_id) === String(form.state_id));

    const handleStateChange = (stateId) => {
        setForm(f => ({ ...f, state_id: stateId, city_id: '' }));
    };

    const handleGpsLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }
        setFetchingGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm(f => ({
                    ...f,
                    latitude: pos.coords.latitude.toFixed(7),
                    longitude: pos.coords.longitude.toFixed(7),
                }));
                setFetchingGps(false);
            },
            (err) => {
                alert(`Failed to get location: ${err.message}`);
                setFetchingGps(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(shop.id, form);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-auto">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Edit className="h-4 w-4 text-indigo-600" /> Edit Shop — {shop.shop_name}
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>State</label>
                        <select className={inputCls} value={form.state_id} onChange={e => handleStateChange(e.target.value)} required>
                            <option value="">Select State</option>
                            {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>City</label>
                        <select className={inputCls} value={form.city_id} onChange={e => setForm(f => ({ ...f, city_id: e.target.value }))} required disabled={!form.state_id}>
                            <option value="">{form.state_id ? 'Select City' : 'Select state first'}</option>
                            {filteredCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Shop Name</label>
                        <input className={inputCls} value={form.shop_name} onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} required />
                    </div>
                    <div>
                        <label className={labelCls}>GST Number</label>
                        <input className={inputCls} value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Shop Address</label>
                        <input className={inputCls} value={form.shop_address} onChange={e => setForm(f => ({ ...f, shop_address: e.target.value }))} />
                    </div>
                    <div>
                        <label className={labelCls}>Manager Name</label>
                        <input className={inputCls} value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} />
                    </div>
                    <div>
                        <label className={labelCls}>Mobile Number</label>
                        <input className={inputCls} value={form.mobile_number} onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))} />
                    </div>
                    <div>
                        <label className={labelCls}>Document Type</label>
                        <select className={inputCls} value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}>
                            {['aadhaar', 'pan', 'voter'].map(d => (
                                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Document Number</label>
                        <input className={inputCls} value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} />
                    </div>
                    <div>
                        <label className={labelCls}>Primary User (Optional)</label>
                        <select className={inputCls} value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
                            <option value="">-- No User --</option>
                            {users.filter(u => u.role === 'shop_user').map(u => (
                                <option key={u.id} value={u.id}>{u.name || u.mobile} ({u.mobile})</option>
                            ))}
                        </select>
                    </div>

                    <div className="sm:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-indigo-600" /> Geofence Configuration
                            </span>
                            <button
                                type="button"
                                onClick={handleGpsLocation}
                                disabled={fetchingGps}
                                className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                            >
                                {fetchingGps ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />} Use Current Location
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={labelCls}>Latitude</label>
                                <input type="number" step="any" className={inputCls} placeholder="e.g. 18.520430" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
                            </div>
                            <div>
                                <label className={labelCls}>Longitude</label>
                                <input type="number" step="any" className={inputCls} placeholder="e.g. 73.856743" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
                            </div>
                            <div>
                                <label className={labelCls}>Radius (metres)</label>
                                <input type="number" min="1" className={inputCls} placeholder="50" value={form.geofence_radius_m} onChange={e => setForm(f => ({ ...f, geofence_radius_m: e.target.value }))} />
                            </div>
                        </div>
                    </div>

                    <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeleteConfirmModal = ({ shop, onConfirm, onCancel, deleting, result }) => {
    const [step,      setStep]      = useState('password'); // 'password' | 'confirm'
    const [password,  setPassword]  = useState('');
    const [showPwd,   setShowPwd]   = useState(false);
    const [pwdError,  setPwdError]  = useState('');
    const [verifying, setVerifying] = useState(false);
    const [typed,     setTyped]     = useState('');
    const confirmed = typed === shop.shop_name;

    const handleVerify = async (e) => {
        e.preventDefault();
        setVerifying(true); setPwdError('');
        try {
            await api.post('/auth/verify-password', { password });
            setStep('confirm');
        } catch (err) {
            setPwdError(err.response?.data?.error || 'Incorrect password.');
        } finally { setVerifying(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Delete All Shop Data</h2>
                        <p className="text-xs text-gray-500">This action cannot be undone</p>
                    </div>
                </div>

                {result ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm">
                        <p className="font-semibold text-green-700 mb-2">{result.message}</p>
                        <ul className="text-green-600 space-y-0.5 text-xs">
                            <li>Daily entries deleted: <strong>{result.deleted.daily_entries}</strong></li>
                            <li>Cash flows deleted: <strong>{result.deleted.cash_flows}</strong></li>
                            <li>Excel uploads deleted: <strong>{result.deleted.excel_uploads}</strong></li>
                            <li>Cash transfers deleted: <strong>{result.deleted.cash_transfers}</strong></li>
                            <li>Shop wallets reset: <strong>{result.wallets_reset}</strong></li>
                            <li>Manager wallets recalculated: <strong>{result.managers_recalculated}</strong></li>
                        </ul>
                    </div>
                ) : step === 'password' ? (
                    <form onSubmit={handleVerify}>
                        <p className="text-sm text-gray-700 mb-4">
                            Enter your admin password to authorise deletion of all data for <strong>{shop.shop_name}</strong>.
                        </p>
                        <div className="relative mb-3">
                            <input
                                type={showPwd ? 'text' : 'password'}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none"
                                placeholder="Your password"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setPwdError(''); }}
                                disabled={verifying}
                                autoFocus
                                required
                            />
                            <button type="button" onClick={() => setShowPwd(v => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {pwdError && <p className="text-xs text-red-500 mb-3">{pwdError}</p>}
                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={onCancel}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={!password || verifying}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center gap-2">
                                {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Verify & Continue
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <p className="text-sm text-gray-700 mb-3">
                            You are about to permanently delete <strong>all entries, transfers, cash flows, Excel uploads</strong> and <strong>reset all wallet balances</strong> for:
                        </p>
                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4 text-center">
                            <span className="text-red-700 font-bold text-lg">{shop.shop_name}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                            To confirm, type the shop name exactly as shown above:
                        </p>
                        <input
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 outline-none mb-4"
                            placeholder={shop.shop_name}
                            value={typed}
                            onChange={e => setTyped(e.target.value)}
                            disabled={deleting}
                            autoFocus
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={onCancel}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={!confirmed || deleting}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                {deleting ? (
                                    <>
                                        <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Yes, Delete All Data
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {result && (
                    <div className="flex justify-end mt-4">
                        <button onClick={onCancel}
                            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ShopsPage = () => {
    const navigate = useNavigate();
    const [states, setStates] = useState([]);
    const [allCities, setAllCities] = useState([]);
    const [filteredCities, setFilteredCities] = useState([]);
    const [shops, setShops] = useState([]);
    const [users, setUsers] = useState([]);
    const [shopForm, setShopForm] = useState(EMPTY_SHOP);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteResult, setDeleteResult] = useState(null);
    const [editShop, setEditShop] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [fetchingFormGps, setFetchingFormGps] = useState(false);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [locRes, shopsRes, usersRes] = await Promise.all([
                api.get('/locations'),
                api.get('/shops'),
                api.get('/users').catch(() => ({ data: [] })),
            ]);
            setStates(locRes.data.states);
            setAllCities(locRes.data.cities);
            setShops(shopsRes.data);
            setUsers(usersRes.data);
        } finally {
            setLoading(false);
        }
    };

    const handleStateChange = (stateId) => {
        setShopForm(f => ({ ...f, state_id: stateId, city_id: '' }));
        setFilteredCities(allCities.filter(c => String(c.state_id) === String(stateId)));
    };

    const handleFormGps = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }
        setFetchingFormGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setShopForm(f => ({
                    ...f,
                    latitude: pos.coords.latitude.toFixed(7),
                    longitude: pos.coords.longitude.toFixed(7),
                }));
                setFetchingFormGps(false);
            },
            (err) => {
                alert(`Failed to get location: ${err.message}`);
                setFetchingFormGps(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleShopSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/shops', shopForm);
            setShopForm(EMPTY_SHOP);
            setFilteredCities([]);
            loadAll();
            alert('Shop created!');
        } catch (err) {
            alert(err.response?.data?.error || 'Error creating shop');
        }
    };

    const handleEditSave = async (id, updatedForm) => {
        setSavingEdit(true);
        try {
            await api.put(`/shops/${id}`, updatedForm);
            setEditShop(null);
            loadAll();
            alert('Shop updated successfully!');
        } catch (err) {
            alert(err.response?.data?.error || 'Error updating shop');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteShopData = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await api.delete(`/shops/${deleteTarget.id}/data`);
            setDeleteResult(res.data);
        } catch (err) {
            alert(err.response?.data?.error || 'Deletion failed. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const closeDeleteModal = () => {
        setDeleteTarget(null);
        setDeleteResult(null);
        setDeleting(false);
    };

    return (
        <Layout title="Shop Management">
            {deleteTarget && (
                <DeleteConfirmModal
                    shop={deleteTarget}
                    onConfirm={handleDeleteShopData}
                    onCancel={closeDeleteModal}
                    deleting={deleting}
                    result={deleteResult}
                />
            )}
            {editShop && (
                <EditShopModal
                    shop={editShop}
                    states={states}
                    allCities={allCities}
                    users={users}
                    onSave={handleEditSave}
                    onCancel={() => setEditShop(null)}
                    saving={savingEdit}
                />
            )}
            <div className="mb-8">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Plus className="h-4 w-4 text-indigo-500" /> Add New Shop
                    </h3>
                    <form onSubmit={handleShopSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>State</label>
                            <select
                                className={inputCls}
                                value={shopForm.state_id}
                                onChange={e => handleStateChange(e.target.value)}
                                required
                            >
                                <option value="">Select State</option>
                                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className={labelCls}>City</label>
                            <select
                                className={inputCls}
                                value={shopForm.city_id}
                                onChange={e => setShopForm(f => ({ ...f, city_id: e.target.value }))}
                                required
                                disabled={!shopForm.state_id}
                            >
                                <option value="">{shopForm.state_id ? 'Select City' : 'Select state first'}</option>
                                {filteredCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {[
                            ['shop_name', 'Shop Name', true],
                            ['gst_number', 'GST Number', false],
                            ['shop_address', 'Address', false],
                            ['manager_name', 'Manager Name', false],
                            ['mobile_number', 'Mobile', false],
                            ['document_number', 'Document Number', false],
                        ].map(([field, label, req]) => (
                            <div key={field}>
                                <label className={labelCls}>{label}</label>
                                <input
                                    className={inputCls}
                                    value={shopForm[field]}
                                    onChange={e => setShopForm(f => ({ ...f, [field]: e.target.value }))}
                                    placeholder={label}
                                    required={req}
                                />
                            </div>
                        ))}

                        <div>
                            <label className={labelCls}>Document Type</label>
                            <select
                                className={inputCls}
                                value={shopForm.document_type}
                                onChange={e => setShopForm(f => ({ ...f, document_type: e.target.value }))}
                            >
                                {['aadhaar', 'pan', 'voter'].map(d => (
                                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelCls}>Assign Primary User (Optional)</label>
                            <select
                                className={inputCls}
                                value={shopForm.user_id}
                                onChange={e => setShopForm(f => ({ ...f, user_id: e.target.value }))}
                            >
                                <option value="">-- No User --</option>
                                {users.filter(u => u.role === 'shop_user').map(u => (
                                    <option key={u.id} value={u.id}>{u.name || u.mobile} ({u.mobile})</option>
                                ))}
                            </select>
                        </div>

                        {/* Geofence Configuration Section */}
                        <div className="sm:col-span-2 lg:col-span-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4 text-indigo-600" /> Geofence Configuration
                                </span>
                                <button
                                    type="button"
                                    onClick={handleFormGps}
                                    disabled={fetchingFormGps}
                                    className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    {fetchingFormGps ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />} Use Current Location
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className={labelCls}>Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        className={inputCls}
                                        placeholder="e.g. 18.520430"
                                        value={shopForm.latitude}
                                        onChange={e => setShopForm(f => ({ ...f, latitude: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        className={inputCls}
                                        placeholder="e.g. 73.856743"
                                        value={shopForm.longitude}
                                        onChange={e => setShopForm(f => ({ ...f, longitude: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Radius (metres)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className={inputCls}
                                        placeholder="50"
                                        value={shopForm.geofence_radius_m}
                                        onChange={e => setShopForm(f => ({ ...f, geofence_radius_m: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-3">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Create Shop
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-800">
                        All Shops {!loading && `(${shops.length})`}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Shop Name', 'City', 'State', 'GST', 'Manager', 'Geofence (GPS)', 'Users', 'Actions'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="8" className="text-center py-10 text-gray-400">Loading...</td></tr>
                            ) : shops.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-10 text-gray-400">No shops created yet</td></tr>
                            ) : shops.map(shop => (
                                <tr key={shop.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-sm font-semibold text-indigo-600">{shop.shop_name}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.city_name}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.state_name}</td>
                                    <td className="px-5 py-3 text-sm text-gray-500 font-mono">{shop.gst_number || '—'}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.manager_name || '—'}</td>
                                    <td className="px-5 py-3 text-xs">
                                        {shop.latitude != null && shop.longitude != null ? (
                                            <span className="font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded inline-flex items-center gap-1">
                                                📍 {Number(shop.latitude).toFixed(4)}, {Number(shop.longitude).toFixed(4)} ({shop.geofence_radius_m || 50}m)
                                            </span>
                                        ) : (
                                            <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                No GPS
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${parseInt(shop.user_count) > 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {parseInt(shop.user_count) > 0 ? `${shop.user_count} User${shop.user_count > 1 ? 's' : ''}` : 'Unassigned'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setEditShop(shop)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                                title={`Edit ${shop.shop_name}`}
                                            >
                                                <Edit className="h-3.5 w-3.5" /> Edit
                                            </button>
                                            <button
                                                onClick={() => navigate(`/admin/new-entry?shop_id=${shop.id}`)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all whitespace-nowrap"
                                                style={{ background: '#FF6B00' }}
                                                title={`New entry for ${shop.shop_name}`}
                                            >
                                                <PlusCircle className="h-3.5 w-3.5" /> New Entry
                                            </button>
                                            <button
                                                onClick={() => { setDeleteTarget(shop); setDeleteResult(null); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors whitespace-nowrap"
                                                title={`Delete all data for ${shop.shop_name}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Delete Data
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default ShopsPage;
