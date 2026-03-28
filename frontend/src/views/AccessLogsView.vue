<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import { apiRequest } from '../services/api';
import { joinDashboard, leaveDashboard, onGateOpened, offGateOpened } from '../services/socket';

const logs = ref([]);
const filters = reactive({ from: '', to: '' });
const loading = ref(false);
const exporting = ref(false);
const imageModalOpen = ref(false);
const selectedImage = ref('');
const notification = ref('');
let refreshInterval = null;

async function loadLogs() {
  loading.value = true;
  const search = new URLSearchParams();
  if (filters.from) search.append('from', filters.from);
  if (filters.to) search.append('to', filters.to);
  const query = search.toString() ? `?${search.toString()}` : '';

  try {
    const response = await apiRequest(`/api/access-logs${query}`);
    logs.value = response.data;
  } finally {
    loading.value = false;
  }
}

async function exportPdf() {
  exporting.value = true;
  try {
    const blob = await apiRequest('/api/access-logs/export/pdf');
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'access-logs-report.pdf';
    link.click();
    window.URL.revokeObjectURL(url);
  } finally {
    exporting.value = false;
  }
}

function openImageModal(imagePath) {
  selectedImage.value = imagePath;
  imageModalOpen.value = true;
}

function handleGateOpened(data) {
  console.log('Gate opened - reloading access logs:', data);
  notification.value = '🚪 New entry detected! Refreshing logs...';
  loadLogs();
  setTimeout(() => {
    notification.value = '';
  }, 3000);
}

onMounted(() => {
  // Initial load
  loadLogs();
  
  // Join dashboard room untuk real-time updates
  joinDashboard();
  
  // Listen ke gate opened events
  onGateOpened(handleGateOpened);
  
  // Auto refresh logs setiap 15 detik
  refreshInterval = setInterval(() => {
    loadLogs();
  }, 15000);
  
  console.log('AccessLogs mounted - Real-time updates enabled');
});

onUnmounted(() => {
  // Cleanup saat component unmount
  leaveDashboard();
  offGateOpened(handleGateOpened);
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  console.log('AccessLogs unmounted - Real-time updates disabled');
});
</script>

<template>
  <AppShell>
    <section class="page-header">
      <div>
        <p class="eyebrow">Access Logs</p>
        <h2>Riwayat validasi kendaraan</h2>
        <p class="muted-text">Data diambil dari tabel access_logs dan dapat diekspor ke PDF.</p>
      </div>
      <button class="primary-button" @click="exportPdf">{{ exporting ? 'Menyiapkan PDF...' : 'Export PDF' }}</button>
    </section>

    <p v-if="notification" class="success-banner">{{ notification }}</p>

    <section class="panel-card">
      <div class="filter-row">
        <label>
          Dari tanggal
          <input v-model="filters.from" type="date" />
        </label>
        <label>
          Sampai tanggal
          <input v-model="filters.to" type="date" />
        </label>
        <button class="ghost-button" @click="loadLogs">{{ loading ? 'Loading...' : 'Terapkan Filter' }}</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Driver ID</th>
              <th>Nama Driver</th>
              <th>Muatan</th>
              <th>BLE Plate</th>
              <th>OCR Plate</th>
              <th>Status</th>
              <th>Snapshot</th>
              <th>Waktu Masuk</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ log.client_id || '-' }}</td>
              <td>{{ log.driver_id || '-' }}</td>
              <td>{{ log.driver_name || '-' }}</td>
              <td>{{ log.muatan || '-' }}</td>
              <td>{{ log.plat_ble || '-' }}</td>
              <td>{{ log.plat_ocr || '-' }}</td>
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
