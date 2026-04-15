import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Plus, ChevronDown } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

const ShopsPage = () => {
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    const [shops, setShops] = useState([]);
    const [users, setUsers] = useState([]);

    const [stateForm, setStateForm] = useState({ name: '' });
    const [cityForm, setCityForm] = useState({ state_id: '', name: '' });
    const [shopForm, setShopForm] = useState({ state_id: '', city_id: '', shop_name: '', gst_number: '', shop_address: '', manager_name: '', mobile_number: '', document_type: 'aadhaar', document_number: '', user_id: '' });

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        const [s, sh, u] = await Promise.all([api.get('/locations/states'), api.get('/shops'), api.get('/users').catch(() => ({ data: [] }))]);
        setStates(s.data);
        setShops(sh.data);
        setUsers(u.data);
    };

    const loadCities = async (stateId) => {
        if (!stateId) return setCities([]);
        const res = await api.get(`/locations/cities/${stateId}`);
        setCities(res.data);
    };

    const handleStateSubmit = async (e) => {
        e.preventDefault();
        try { await api.post('/locations/states', stateForm); setStateForm({ name: '' }); loadAll(); alert('State created!'); }
        catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const handleCitySubmit = async (e) => {
        e.preventDefault();
        try { await api.post('/locations/cities', cityForm); setCityForm({ state_id: '', name: '' }); loadAll(); alert('City created!'); }
        catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const handleShopSubmit = async (e) => {
        e.preventDefault();
        try { await api.post('/shops', shopForm); setShopForm({ state_id: '', city_id: '', shop_name: '', gst_number: '', shop_address: '', manager_name: '', mobile_number: '', document_type: 'aadhaar', document_number: '', user_id: '' }); loadAll(); alert('Shop created!'); }
        catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    return (
        <Layout title="Shop Management">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Create State */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-indigo-500" /> Add State</h3>
                    <form onSubmit={handleStateSubmit} className="space-y-4">
                        <div><label className={labelCls}>State Name</label><input className={inputCls} value={stateForm.name} onChange={e => setStateForm({ name: e.target.value })} placeholder="e.g. Maharashtra" required /></div>
                        <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Create State</button>
                    </form>
                </div>

                {/* Create City */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-indigo-500" /> Add City</h3>
                    <form onSubmit={handleCitySubmit} className="space-y-4">
                        <div>
                            <label className={labelCls}>State</label>
                            <select className={inputCls} value={cityForm.state_id} onChange={e => { setCityForm({ ...cityForm, state_id: e.target.value }); loadCities(e.target.value); }} required>
                                <option value="">Select State</option>
                                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div><label className={labelCls}>City Name</label><input className={inputCls} value={cityForm.name} onChange={e => setCityForm({ ...cityForm, name: e.target.value })} placeholder="e.g. Pune" required /></div>
                        <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Create City</button>
                    </form>
                </div>

                {/* Create Shop */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-indigo-500" /> Add Shop</h3>
                    <form onSubmit={handleShopSubmit} className="space-y-3">
                        <div>
                            <label className={labelCls}>State</label>
                            <select className={inputCls} value={shopForm.state_id} onChange={e => { setShopForm({ ...shopForm, state_id: e.target.value, city_id: '' }); loadCities(e.target.value); }} required>
                                <option value="">Select State</option>
                                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>City</label>
                            <select className={inputCls} value={shopForm.city_id} onChange={e => setShopForm({ ...shopForm, city_id: e.target.value })} required>
                                <option value="">Select City</option>
                                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        {[['shop_name', 'Shop Name'], ['gst_number', 'GST Number'], ['shop_address', 'Address'], ['manager_name', 'Manager Name'], ['mobile_number', 'Mobile'], ['document_number', 'Document Number']].map(([field, label]) => (
                            <div key={field}><label className={labelCls}>{label}</label><input className={inputCls} value={shopForm[field]} onChange={e => setShopForm({ ...shopForm, [field]: e.target.value })} placeholder={label} /></div>
                        ))}
                        <div>
                            <label className={labelCls}>Document Type</label>
                            <select className={inputCls} value={shopForm.document_type} onChange={e => setShopForm({ ...shopForm, document_type: e.target.value })}>
                                {['aadhaar', 'pan', 'voter'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Assign User (Optional)</label>
                            <select className={inputCls} value={shopForm.user_id} onChange={e => setShopForm({ ...shopForm, user_id: e.target.value })}>
                                <option value="">-- No User --</option>
                                {users.filter(u => u.role === 'shop_user').map(u => <option key={u.id} value={u.id}>{u.name || u.mobile} ({u.mobile})</option>)}
                            </select>
                        </div>
                        <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Create Shop</button>
                    </form>
                </div>
            </div>

            {/* Shops Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-base font-semibold text-gray-800">All Shops ({shops.length})</h3></div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>{['Shop Name', 'City', 'State', 'GST', 'Manager', 'Mobile', 'Status'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {shops.map(shop => (
                                <tr key={shop.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-sm font-semibold text-indigo-600">{shop.shop_name}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.city_name}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.state_name}</td>
                                    <td className="px-5 py-3 text-sm text-gray-500 font-mono">{shop.gst_number || '—'}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.manager_name || '—'}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.mobile_number || '—'}</td>
                                    <td className="px-5 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${shop.user_id ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{shop.user_id ? 'Assigned' : 'Unassigned'}</span></td>
                                </tr>
                            ))}
                            {shops.length === 0 && <tr><td colSpan="7" className="text-center py-10 text-gray-400">No shops created yet</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default ShopsPage;
