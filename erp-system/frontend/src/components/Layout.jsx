import React, { useContext } from 'react';
import Sidebar from './Sidebar';
import { AuthContext } from '../context/AuthContext';

const Layout = ({ children, title }) => {
    const { user } = useContext(AuthContext);

    return (
        <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                {/* Topbar */}
                <header className="sticky top-0 z-10 px-8 py-4 flex items-center justify-between shadow-sm border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#FF6B00' }}>SIZE24 ERP</p>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name || user?.mobile}</p>
                            <p className="text-xs capitalize px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,107,0,0.12)', color: '#FF6B00' }}>
                                {user?.role?.replace('_', ' ')}
                            </p>
                        </div>
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#FF6B00' }}>
                            {(user?.name || user?.mobile || 'U')[0].toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-8">
                    {children}
                </main>

                {/* Footer */}
                <footer className="px-8 py-3 text-center text-xs border-t" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}>
                    Powered by <span className="font-bold" style={{ color: '#FF6B00' }}>SIZE24</span> &middot; Smart Retail ERP System
                </footer>
            </div>
        </div>
    );
};

export default Layout;
