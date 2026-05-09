<script setup>
import { RouterView, RouterLink } from 'vue-router'
import TopNav from './components/TopNav.vue'
import SiteFooter from './components/SiteFooter.vue'
</script>

<template>
  <div class="paper min-h-screen flex flex-col">
    <TopNav />
    <RouterView v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
    <SiteFooter />
  </div>
</template>

<style>
.page-enter-active, .page-leave-active { transition: opacity .28s ease, transform .28s ease; }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
