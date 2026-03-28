<script setup>
import { reactive, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { apiRequest } from '../services/api';
import { setAuthSession } from '../stores/auth';

const router = useRouter();
const form = reactive({ username: '', full_name: '', email: '', password: '' });
const loading = ref(false);
const errorMessage = ref('');

async function submitRegister() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await apiRequest('/api/auth/register', {
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
      <p class="eyebrow">Operator Onboarding</p>
      <h1>Buat akun admin untuk mengelola ekosistem Smart Gate.</h1>
      <p class="muted-text">
        Registrasi ini menyimpan akun ke MySQL agar frontend dan backend memakai sumber data yang sama.
      </p>
    </section>

    <section class="auth-card auth-form-card">
      <div class="section-header stacked">
        <div>
          <p class="eyebrow">Register</p>
          <h2>Daftar akun operator</h2>
        </div>
        <p class="muted-text">Lengkapi data di bawah ini.</p>
      </div>

      <form class="form-grid" @submit.prevent="submitRegister">
        <label>
          Username
          <input v-model="form.username" type="text" placeholder="operator1" />
        </label>
        <label>
          Nama lengkap
          <input v-model="form.full_name" type="text" placeholder="Nama Operator" />
        </label>
        <label>
          Email
          <input v-model="form.email" type="email" placeholder="operator@mail.com" />
        </label>
        <label>
          Password
          <input v-model="form.password" type="password" placeholder="••••••••" />
        </label>

        <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? 'Memproses...' : 'Register' }}
        </button>
      </form>

      <p class="footer-link">
        Sudah punya akun?
        <RouterLink to="/login">Login di sini</RouterLink>
      </p>
    </section>
  </div>
</template>
