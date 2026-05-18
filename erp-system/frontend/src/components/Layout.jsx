import React, { useContext, useState } from 'react';
import Sidebar from './Sidebar';
import AIChat from './AIChat';
import { AuthContext } from '../context/AuthContext';
import { Menu } from 'lucide-react';

const Layout = ({ children, title }) => {
    const { user } = useContext(AuthContext);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>

            {/* Mobile backdrop — closes sidebar on outside tap */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Desktop spacer — reserves sidebar width so content shifts right */}
            <div className="hidden md:block w-64 flex-shrink-0" />

            {/* Sidebar — always fixed, slides in/out on mobile, always visible on desktop */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Topbar */}
                <header
                    className="sticky top-0 z-10 px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm border-b"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                >
                    <div className="flex items-center gap-3">
                        {/* Hamburger — mobile only */}
                        <button
                            className="md:hidden p-2 rounded-lg transition-colors"
                            onClick={() => setSidebarOpen(true)}
                            style={{ color: 'var(--text-primary)' }}
                            aria-label="Open navigation"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#FF6B00' }}>SIZE24 ERP</p>
                            <h1 className="text-base sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name || user?.mobile}</p>
                            <p className="text-xs capitalize px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,107,0,0.12)', color: '#FF6B00' }}>
                                {user?.role?.replace('_', ' ')}
                            </p>
                        </div>
                        <div
                            className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ background: '#FF6B00' }}
                        >
                            {(user?.name || user?.mobile || 'U')[0].toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 sm:p-6 md:p-8">
                    {children}
                </main>

                {/* Footer */}
                <footer
                    className="px-4 sm:px-8 py-3 text-center text-xs border-t"
                    style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}
                >
                    Powered by <span className="font-bold" style={{ color: '#FF6B00' }}>SIZE24</span> &middot; Smart Retail ERP System
                </footer>
            </div>

            {/* AI Chat — floating, admin & manager only */}
            <AIChat />
        </div>
    );
};

export default Layout;
