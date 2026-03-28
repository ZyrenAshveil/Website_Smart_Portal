<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import StatCard from '../components/StatCard.vue';
import AccessChart from '../components/AccessChart.vue';
import { apiRequest } from '../services/api';
import { joinDashboard, leaveDashboard, onGateOpened, offGateOpened } from '../services/socket';

const summary = ref({
  totalClients: 0,
  activeClients: 0,
  totalAccess: 0,
  validAccess: 0,
  invalidAccess: 0,
  recentLogs: []
});
const loading = ref(false);
const message = ref('');
const messageType = ref('success');
const imageModalOpen = ref(false);
const selectedImage = ref('');
let refreshInterval = null;

async function loadDashboard() {
  loading.value = true;
  try {
    const response = await apiRequest('/api/dashboard');
    summary.value = response.data;
  } finally {
    loading.value = false;
  }
}

async function manualOpen() {
  try {
    const response = await apiRequest('/api/gate/manual-open', {
      method: 'POST',
      body: JSON.stringify({ client_id: 'WEB_DASHBOARD', notes: 'Triggered from dashboard' })
    });
    message.value = 'Portal dibuka! Status: ' + response.message;
    messageType.value = 'success';
    // Refresh immediately after manual open
    await loadDashboard();
  } catch (error) {
    message.value = 'Error: ' + (error.message || 'Gagal membuka portal');
    messageType.value = 'error';
  }
}

function openImageModal(imagePath) {
  selectedImage.value = imagePath;
  imageModalOpen.value = true;
}

function handleGateOpened(data) {
  console.log('Gate opened event received:', data);
  message.value = '🚪 ' + data.message + ' (Real-time update)';
  messageType.value = 'success';
  // Refresh dashboard saat ada gate opened event
  loadDashboard();
  // Clear message setelah 5 detik
  setTimeout(() => {
    message.value = '';
  }, 5000);
}

onMounted(() => {
  // Initial load
  loadDashboard();
  
  // Join dashboard room untuk real-time updates
  joinDashboard();
  
  // Listen ke gate opened events
  onGateOpened(handleGateOpened);
  
  // Auto refresh dashboard setiap 10 detik
  refreshInterval = setInterval(() => {
    loadDashboard();
  }, 10000);
  
  console.log('Dashboard mounted - Real-time updates enabled');
});

onUnmounted(() => {
  // Cleanup saat component unmount
  leaveDashboard();
  offGateOpened(handleGateOpened);
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  console.log('Dashboard unmounted - Real-time updates disabled');
});
</script>

<template>
  <AppShell>
    <section class="page-header">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h2>Ringkasan sistem Smart Gate</h2>
        <p class="muted-text">Memantau validasi gate, client aktif, dan log akses terbaru.</p>
      </div>
      <button class="danger-button" @click="manualOpen">Urgent Buka Portal Manual</button>
    </section>

    <p v-if="message" :class="messageType === 'success' ? 'success-banner' : 'error-banner'">{{ message }}</p>

    <section class="stats-grid">
      <StatCard label="Total Client" :value="summary.totalClients" accent="#1046b8" />
      <StatCard label="Client Aktif" :value="summary.activeClients" accent="#00875a" />
      <StatCard label="Total Access" :value="summary.totalAccess" accent="#6b4eff" />
      <StatCard label="Access Valid" :value="summary.validAccess" accent="#00a7cc" />
      <StatCard label="Access Invalid" :value="summary.invalidAccess" accent="#c84d11" />
    </section>

    <AccessChart :accessData="summary.recentLogs" />

    <section class="panel-card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Recent Access</p>
          <h3>10 log terbaru</h3>
        </div>
        <button class="ghost-button" @click="loadDashboard">{{ loading ? 'Refreshing...' : 'Refresh' }}</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Driver</th>
              <th>BLE Plate</th>
              <th>OCR Plate</th>
              <th>Status</th>
              <th>Snapshot</th>
              <th>Waktu</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in summary.recentLogs" :key="log.id">
              <td>{{ log.client_id }}</td>
              <td>{{ log.driver_name }}</td>
              <td>{{ log.plat_ble }}</td>
              <td>{{ log.plat_ocr }}</td>
              <td><span :class="['status-pill', `status-${log.status.toLowerCase()}`]">{{ log.status }}</span></td>
              <td>
                <img v-if="log.image_path_masuk" :src="log.image_path_masuk" alt="Snapshot" style="width: 60px; height: auto; cursor: pointer; border-radius: 4px;" @click="openImageModal(log.image_path_masuk)" />
                <span v-else style="color: #999;">-</span>
              </td>
              <td>{{ new Date(log.waktu_masuk).toLocaleString('id-ID') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="imageModalOpen" class="modal-backdrop" @click="imageModalOpen = false">
      <section class="modal-card" @click.stop>
        <div class="section-header">
          <p class="eyebrow">Snapshot Preview</p>
          <button class="ghost-button" @click="imageModalOpen = false">Tutup</button>
        </div>
        <div style="display: flex; justify-content: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
          <img :src="selectedImage" alt="Full Snapshot" style="max-width: 100%; max-height: 500px; border-radius: 8px;" />
        </div>
      </section>
    </div>
  </AppShell>
</template>
