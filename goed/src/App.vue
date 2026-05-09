<script setup></script>

<template>
  <header class="bg-utah-blue text-white">
    <nav class="flex gap-4 p-4">
      <RouterLink to="/" class="hover:text-hiring-green">Map</RouterLink>
      <RouterLink to="/navigator" class="hover:text-hiring-green">Navigator</RouterLink>
      <RouterLink to="/submit" class="hover:text-hiring-green">Submit</RouterLink>
      <RouterLink to="/admin" class="hover:text-hiring-green">Admin</RouterLink>
      <RouterLink to="/roadmap" class="hover:text-hiring-green">Roadmap</RouterLink>
      <RouterLink to="/subscribe" class="hover:text-hiring-green">Subscribe</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style scoped></style>
