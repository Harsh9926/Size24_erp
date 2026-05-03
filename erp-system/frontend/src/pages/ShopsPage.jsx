import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Plus, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

const EMPTY_SHOP = {
    state_id: '', city_id: '', shop_name: '', gst_number: '',
    shop_address: '', manager_name: '', mobile_number: '',
    document_type: 'aadhaar', document_number: '', user_id: '',
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

    return (
        <Layout title="Shop Management">
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
                            <label className={labelCls}>Assign User (Optional)</label>
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
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-800">
                        All Shops {!loading && `(${shops.length})`}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Shop Name', 'City', 'State', 'GST', 'Manager', 'Mobile', 'Status', ''].map(h => (
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
                                    <td className="px-5 py-3 text-sm text-gray-600">{shop.mobile_number || '—'}</td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${parseInt(shop.user_count) > 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {parseInt(shop.user_count) > 0 ? `${shop.user_count} User${shop.user_count > 1 ? 's' : ''}` : 'Unassigned'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <button
                                            onClick={() => navigate(`/admin/new-entry?shop_id=${shop.id}`)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all whitespace-nowrap"
                                            style={{ background: '#FF6B00' }}
                                            title={`New entry for ${shop.shop_name}`}
                                        >
                                            <PlusCircle className="h-3.5 w-3.5" /> New Entry
                                        </button>
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
