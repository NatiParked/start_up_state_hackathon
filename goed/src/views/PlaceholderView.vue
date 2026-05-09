<script setup>
defineProps({
  title: { type: String, required: true },
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-white">
    <section class="max-w-md text-center p-8 border border-utah-blue rounded">
      <h1 class="text-2xl font-semibold text-utah-blue">{{ title }}</h1>
      <p class="mt-2 text-utah-blue-dark">Coming soon.</p>
    </section>
  </main>
</template>

<style scoped></style>
