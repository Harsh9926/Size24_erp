import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Request interceptor to add the JWT token to headers
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor to handle token expiry or auth errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const msg    = error.response?.data?.error;

        const shouldLogout =
            status === 401 ||
            (status === 403 && (
                msg === 'Invalid or expired token' ||
                msg === 'Access token missing' ||
                msg === 'Insufficient permissions'
            ));

        if (shouldLogout && localStorage.getItem('token')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
