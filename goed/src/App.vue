<script setup></script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <header class="topnav shrink-0">
      <RouterLink to="/" class="brand-mark">Utah<span class="amp">&amp;</span>Startups</RouterLink>
      <nav class="flex items-center gap-6">
        <RouterLink to="/">Map</RouterLink>
        <RouterLink to="/navigator">Navigator</RouterLink>
        <RouterLink to="/submit">Submit</RouterLink>
        <RouterLink to="/admin">Admin</RouterLink>
        <RouterLink to="/roadmap">Roadmap</RouterLink>
        <RouterLink to="/subscribe">Subscribe</RouterLink>
      </nav>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.topnav :deep(a.router-link-exact-active) {
  border-bottom-color: var(--accent);
  color: var(--fg);
}
</style>
