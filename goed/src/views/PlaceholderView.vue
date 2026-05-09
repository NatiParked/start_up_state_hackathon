<script setup>
defineProps({
  title: { type: String, required: true },
})
</script>

<template>
  <main class="min-h-screen flex items-center justify-center">
    <section class="card card-pad max-w-md text-center bracketed">
      <div class="kicker">— Soon</div>
      <h1 class="display-sm mt-4 text-[var(--accent)]">{{ title }}</h1>
      <p class="lede mt-2 mx-auto">Coming soon.</p>
    </section>
  </main>
</template>

<style scoped></style>
