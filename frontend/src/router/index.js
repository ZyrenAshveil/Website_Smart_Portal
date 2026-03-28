import { createRouter, createWebHistory } from 'vue-router';
import { authStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import DashboardView from '../views/DashboardView.vue';
import ClientsView from '../views/ClientsView.vue';
import AccessLogsView from '../views/AccessLogsView.vue';
import CameraView from '../views/CameraView.vue';

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: LoginView, meta: { guestOnly: true } },
  { path: '/register', component: RegisterView, meta: { guestOnly: true } },
  { path: '/dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/clients', component: ClientsView, meta: { requiresAuth: true } },
  { path: '/access-logs', component: AccessLogsView, meta: { requiresAuth: true } },
  { path: '/camera', component: CameraView, meta: { requiresAuth: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !authStore.token) {
    return '/login';
  }

  if (to.meta.guestOnly && authStore.token) {
    return '/dashboard';
  }

  return true;
});

export default router;
