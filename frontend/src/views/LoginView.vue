<script setup>
import { reactive, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiRequest } from '../services/api';
import { setAuthSession } from '../stores/auth';

const router = useRouter();
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const errorMessage = ref('');

async function submitLogin() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(form)
    });

    setAuthSession(response.token, response.user);
    router.push('/dashboard');
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <section class="auth-card auth-hero">
      <p class="eyebrow">Smart Gate Portal</p>
      <h1>Kontrol akses kendaraan, validasi OCR, dan monitoring gate dalam satu dashboard.</h1>
      <p class="muted-text">
        Login untuk memantau access log, mengelola client ESP32, melihat snapshot kamera, dan membuka portal manual saat darurat.
      </p>
    </section>

    <section class="auth-card auth-form-card">
      <div class="section-header stacked">
        <div>
          <p class="eyebrow">Login</p>
          <h2>Masuk ke sistem</h2>
        </div>
        <p class="muted-text">Gunakan akun operator yang sudah terdaftar.</p>
      </div>

      <form class="form-grid" @submit.prevent="submitLogin">
        <label>
          Username
          <input v-model="form.username" type="text" placeholder="operator" />
        </label>
        <label>
          Password
          <input v-model="form.password" type="password" placeholder="••••••••" />
        </label>

        <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? 'Memproses...' : 'Login' }}
        </button>
      </form>

      <p class="footer-link">
        Belum punya akun?
        <RouterLink to="/register">Daftar di sini</RouterLink>
      </p>
    </section>
  </div>
</template>
