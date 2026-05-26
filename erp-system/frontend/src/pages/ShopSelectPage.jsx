import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, LogOut, ChevronRight } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const ShopSelectPage = () => {
    const { user, selectShop, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const shops = user?.shops || [];

    const handleSelect = (shop) => {
        selectShop(shop.id, shop.shop_name);
        navigate('/shop');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4"
            style={{ background: 'linear-gradient(135deg, #0d1a2e 0%, #1a0d00 100%)' }}>

            {/* Glow blobs */}
            <div className="fixed top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
                style={{ background: '#FF6B00' }} />
            <div className="fixed bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
                style={{ background: '#FF6B00' }} />

            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                        style={{ background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)' }}>
                        <Store className="w-8 h-8" style={{ color: '#FF6B00' }} />
                    </div>
                    <h1 className="text-2xl font-extrabold text-white mb-1">Select Store</h1>
                    <p className="text-sm" style={{ color: '#9ca3af' }}>
                        Welcome back, <span className="font-semibold text-white">{user?.name || 'User'}</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                        You have access to {shops.length} stores. Choose one to continue.
                    </p>
                </div>

                {/* Shop cards */}
                <div className="space-y-3">
                    {shops.map((shop, i) => (
                        <button
                            key={shop.id}
                            onClick={() => handleSelect(shop)}
                            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-all duration-200 group"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                backdropFilter: 'blur(12px)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,107,0,0.12)';
                                e.currentTarget.style.borderColor = 'rgba(255,107,0,0.5)';
                                e.currentTarget.style.boxShadow = '0 4px 24px rgba(255,107,0,0.2)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm flex-shrink-0"
                                    style={{ background: 'rgba(255,107,0,0.2)', color: '#FF6B00' }}>
                                    {i + 1}
                                </div>
                                <div>
                                    <p className="font-semibold text-white text-sm">{shop.shop_name}</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Tap to open dashboard</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                                style={{ color: 'rgba(255,107,0,0.6)' }} />
                        </button>
                    ))}
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="mt-8 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{ color: '#6b7280', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                >
                    <LogOut className="w-4 h-4" />
                    Sign out
                </button>
            </div>
        </div>
    );
};

export default ShopSelectPage;
