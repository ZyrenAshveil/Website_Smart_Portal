import { reactive } from 'vue';

const storedUser = localStorage.getItem('smart_gate_user');
const storedToken = localStorage.getItem('smart_gate_token');

export const authStore = reactive({
  token: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null
});

export function setAuthSession(token, user) {
  authStore.token = token;
  authStore.user = user;
  localStorage.setItem('smart_gate_token', token);
  localStorage.setItem('smart_gate_user', JSON.stringify(user));
}

export function clearAuthSession() {
  authStore.token = null;
  authStore.user = null;
  localStorage.removeItem('smart_gate_token');
  localStorage.removeItem('smart_gate_user');
}
