import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const ForbiddenPage = () => {
    const { user } = useContext(AuthContext);
    const navigate  = useNavigate();

    const goBack = () => {
        const fallback =
            user?.role === 'admin'    ? '/admin' :
            user?.role === 'manager'  ? '/manager' :
            user?.role === 'shop_user'? '/shop' : '/login';
        navigate(fallback, { replace: true });
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4"
            style={{ background: 'var(--bg-primary)' }}
        >
            <div className="text-center max-w-md">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div
                        className="h-24 w-24 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background: 'rgba(255,107,0,0.12)', border: '2px solid rgba(255,107,0,0.25)' }}
                    >
                        <ShieldOff className="h-12 w-12" style={{ color: '#FF6B00' }} />
                    </div>
                </div>

                {/* Heading */}
                <h1 className="text-5xl font-extrabold mb-2" style={{ color: '#FF6B00' }}>403</h1>
                <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Access Denied
                </h2>
                <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
                    You don&apos;t have permission to access this module.
                    Contact your administrator to request access.
                </p>

                {/* Back button */}
                <button
                    onClick={goBack}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ background: '#FF6B00' }}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default ForbiddenPage;
