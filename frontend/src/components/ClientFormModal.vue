<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  initialData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'submit']);

const form = reactive({
  client_id: '',
  driver_name: '',
  mac_address: '',
  plat_nomor: '',
  is_active: true
});

watch(
  () => props.initialData,
  (value) => {
    form.client_id = value?.client_id || '';
    form.driver_name = value?.driver_name || '';
    form.mac_address = value?.mac_address || '';
    form.plat_nomor = value?.plat_nomor || '';
    form.is_active = Boolean(value?.is_active ?? true);
  },
  { immediate: true }
);

function closeModal() {
  emit('update:modelValue', false);
}

function submitForm() {
  emit('submit', {
    ...form,
    is_active: form.is_active ? 1 : 0
  });
}
</script>

<template>
  <div v-if="modelValue" class="modal-backdrop">
    <section class="modal-card">
      <div class="section-header">
        <div>
          <p class="eyebrow">Registered Client</p>
          <h2>{{ initialData ? 'Edit Client' : 'Tambah Client' }}</h2>
        </div>
        <button class="ghost-button" @click="closeModal">Tutup</button>
      </div>

      <div class="form-grid">
        <label>
          Client ID
          <input v-model="form.client_id" type="text" placeholder="GT-01" />
        </label>
        <label>
          Driver Name
          <input v-model="form.driver_name" type="text" placeholder="Driver Name" />
        </label>
        <label>
          MAC Address
          <input v-model="form.mac_address" type="text" placeholder="AA:BB:CC:DD:EE:FF" />
        </label>
        <label>
          Plate Number
          <input v-model="form.plat_nomor" type="text" placeholder="AB 1234 CD" />
        </label>
        <label class="checkbox-field">
          <input v-model="form.is_active" type="checkbox" />
          Client aktif
        </label>
      </div>

      <div class="actions-row">
        <button class="ghost-button" @click="closeModal">Batal</button>
        <button class="primary-button" @click="submitForm">Simpan</button>
      </div>
    </section>
  </div>
</template>
