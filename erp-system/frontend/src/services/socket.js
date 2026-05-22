import { io } from 'socket.io-client';

/* Connect to same origin — Nginx proxies /socket.io/ to :5000 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

const socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    transports: ['websocket', 'polling'],
});

export default socket;
