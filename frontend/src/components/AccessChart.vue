<script setup>
import { ref, watch } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const props = defineProps({
  accessData: {
    type: Array,
    required: true
  }
});

const chartData = ref({
  labels: [],
  datasets: [
    {
      label: 'Valid Access',
      data: [],
      backgroundColor: '#00875a',
      borderColor: '#005c3e',
      borderWidth: 2,
      borderRadius: 6
    },
    {
      label: 'Invalid Access',
      data: [],
      backgroundColor: '#c84d11',
      borderColor: '#8a3208',
      borderWidth: 2,
      borderRadius: 6
    },
    {
      label: 'Manual Open',
      data: [],
      backgroundColor: '#0066cc',
      borderColor: '#003d99',
      borderWidth: 2,
      borderRadius: 6
    }
  ]
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 15,
        font: {
          size: 12,
          weight: '600'
        }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: 12,
      borderRadius: 8,
      titleFont: { size: 13, weight: 'bold' },
      bodyFont: { size: 12 }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
        font: { size: 11 }
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.05)',
        drawBorder: false
      }
    },
    x: {
      grid: {
        display: false
      },
      ticks: {
        font: { size: 11 }
      }
    }
  }
};

watch(
  () => props.accessData,
  (newData) => {
    if (!newData || newData.length === 0) return;

    // Group data by client
    const groupedByClient = {};
    newData.forEach(log => {
      const client = log.client_id || 'Unknown';
      if (!groupedByClient[client]) {
        groupedByClient[client] = { valid: 0, invalid: 0, manual: 0 };
      }
      
      if (log.status === 'VALID') groupedByClient[client].valid++;
      else if (log.status === 'INVALID') groupedByClient[client].invalid++;
      else if (log.status === 'MANUAL_OPEN') groupedByClient[client].manual++;
    });

    const labels = Object.keys(groupedByClient);
    const validData = labels.map(client => groupedByClient[client].valid);
    const invalidData = labels.map(client => groupedByClient[client].invalid);
    const manualData = labels.map(client => groupedByClient[client].manual);

    chartData.value = {
      labels,
      datasets: [
        {
          label: 'Valid Access',
          data: validData,
          backgroundColor: '#00875a',
          borderColor: '#005c3e',
          borderWidth: 2,
          borderRadius: 6
        },
        {
          label: 'Invalid Access',
          data: invalidData,
          backgroundColor: '#c84d11',
          borderColor: '#8a3208',
          borderWidth: 2,
          borderRadius: 6
        },
        {
          label: 'Manual Open',
          data: manualData,
          backgroundColor: '#0066cc',
          borderColor: '#003d99',
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    };
  },
  { immediate: true }
);
</script>

<template>
  <section class="panel-card chart-section">
    <div class="section-header">
      <div>
        <p class="eyebrow">Access Statistics</p>
        <h3>Grafik validasi akses per client</h3>
      </div>
    </div>

    <div class="chart-container">
      <Bar
        :data="chartData"
        :options="chartOptions"
      />
    </div>
  </section>
</template>

<style scoped>
.chart-section {
  padding: 1.5rem;
}

.chart-container {
  margin-top: 1.5rem;
  position: relative;
  height: 350px;
}

@media (max-width: 768px) {
  .chart-container {
    height: 250px;
  }
}
</style>
