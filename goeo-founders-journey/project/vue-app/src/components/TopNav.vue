<script setup>
import { RouterLink } from 'vue-router'
</script>
<template>
  <header class="topnav">
    <RouterLink to="/" class="brand-mark">Founder<span class="amp">'</span>s Navigator</RouterLink>
    <nav class="flex items-center gap-7">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/quiz">Find resources</RouterLink>
<span class="foot-mark hidden md:inline">Utah — GOEO</span>
    </nav>
  </header>
</template>
