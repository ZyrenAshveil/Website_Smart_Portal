<script setup>
import { useRouter, useRoute } from 'vue-router';
import { authStore, clearAuthSession } from '../stores/auth';

const router = useRouter();
const route = useRoute();

const links = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Clients', path: '/clients' },
  { label: 'Access Logs', path: '/access-logs' },
  { label: 'Camera', path: '/camera' }
];

function logout() {
  clearAuthSession();
  router.push('/login');
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="sidebar-branding">
        <img src="/logo/logo.png" alt="Smart Gate Logo" class="sidebar-logo" />
        <p class="eyebrow">Smart Gate</p>
        <h1>Portal Control</h1>
      </div>

      <nav class="nav-list">
        <router-link
          v-for="link in links"
          :key="link.path"
          :to="link.path"
          class="nav-link"
          :class="{ active: route.path === link.path }"
        >
          {{ link.label }}
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <p>{{ authStore.user?.full_name || 'Operator' }}</p>
        <button class="ghost-button" @click="logout">Logout</button>
      </div>
    </aside>

    <main class="content-area">
      <slot />
    </main>
  </div>
</template>
