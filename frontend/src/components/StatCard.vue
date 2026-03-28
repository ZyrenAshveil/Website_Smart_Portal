<script setup>
defineProps({
  label: String,
  value: [String, Number],
  accent: String
});
</script>

<template>
  <article class="stat-card" :style="{ '--accent': accent || '#245bff' }">
    <p>{{ label }}</p>
    <strong>{{ value }}</strong>
  </article>
</template>
