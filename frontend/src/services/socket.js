import { io } from 'socket.io-client';

let socket = null;

export function initSocket() {
  if (socket) return socket;

  const serverUrl = `http://${window.location.hostname}:4010`;
  
  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
}

export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

export function joinDashboard() {
  const s = getSocket();
  s.emit('join-dashboard');
}

export function leaveDashboard() {
  const s = getSocket();
  s.emit('leave-dashboard');
}

export function onGateOpened(callback) {
  const s = getSocket();
  s.on('gate-opened', callback);
}

export function onDashboardUpdate(callback) {
  const s = getSocket();
  s.on('dashboard-update', callback);
}

export function offGateOpened(callback) {
  const s = getSocket();
  s.off('gate-opened', callback);
}

export function offDashboardUpdate(callback) {
  const s = getSocket();
  s.off('dashboard-update', callback);
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
