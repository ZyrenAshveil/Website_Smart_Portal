<script setup>
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import ClientFormModal from '../components/ClientFormModal.vue';
import { apiRequest } from '../services/api';

const clients = ref([]);
const loading = ref(false);
const errorMessage = ref('');
const modalOpen = ref(false);
const editingClient = ref(null);

async function loadClients() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await apiRequest('/api/clients');
    clients.value = response.data;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingClient.value = null;
  modalOpen.value = true;
}

function openEditModal(client) {
  editingClient.value = client;
  modalOpen.value = true;
}

async function saveClient(payload) {
  const method = editingClient.value ? 'PUT' : 'POST';
  const path = editingClient.value ? `/api/clients/${editingClient.value.id}` : '/api/clients';

  await apiRequest(path, {
    method,
    body: JSON.stringify(payload)
  });

  modalOpen.value = false;
  await loadClients();
}

async function removeClient(id) {
  await apiRequest(`/api/clients/${id}`, { method: 'DELETE' });
  await loadClients();
}

onMounted(loadClients);
</script>

<template>
  <AppShell>
    <section class="page-header">
      <div>
        <p class="eyebrow">Client Registry</p>
        <h2>Kelola data client ESP32</h2>
        <p class="muted-text">Digunakan pada Filter 1 untuk validasi MAC address hardware.</p>
      </div>
      <button class="primary-button" @click="openCreateModal">Tambah Client</button>
    </section>

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <section class="panel-card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Registered Clients</p>
          <h3>Data client tersimpan</h3>
        </div>
        <button class="ghost-button" @click="loadClients">{{ loading ? 'Loading...' : 'Refresh' }}</button>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Driver Name</th>
              <th>MAC Address</th>
              <th>Plate Number</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="client in clients" :key="client.id">
              <td>{{ client.client_id }}</td>
              <td>{{ client.driver_name }}</td>
              <td>{{ client.mac_address }}</td>
              <td>{{ client.plat_nomor || '-' }}</td>
              <td><span class="status-pill">{{ client.is_active ? 'ACTIVE' : 'INACTIVE' }}</span></td>
              <td class="actions-inline">
                <button class="ghost-button" @click="openEditModal(client)">Edit</button>
                <button class="danger-button compact" @click="removeClient(client.id)">Hapus</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ClientFormModal
      v-model="modalOpen"
      :initial-data="editingClient"
      @submit="saveClient"
    />
  </AppShell>
</template>
