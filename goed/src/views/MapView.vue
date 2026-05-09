<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useStartupsStore } from "@/stores/startups";
import UtahMap from "@/components/map/UtahMap.vue";
import EcosystemStatsBar from "@/components/map/EcosystemStatsBar.vue";
import CompanyDrawer from "@/components/drawer/CompanyDrawer.vue";
import FilterSidebar from "@/components/filters/FilterSidebar.vue";
import SubscribeCTA from "@/components/map/SubscribeCTA.vue";

const store = useStartupsStore();
const { companies } = storeToRefs(store);
const { clearSelection } = store;

const layoutClasses = computed(
  () => "flex flex-col flex-1 min-h-0 w-full overflow-hidden",
);
const mapZoneClasses = computed(
  () => "flex flex-col flex-1 min-w-0 min-h-0 relative",
);

function handleMapBackgroundClick() {
  clearSelection();
}

onMounted(() => {
  if (companies.value.length === 0) {
    store.fetchAll();
  }
});
</script>

<template>
  <div :class="layoutClasses">
    <header
      class="border-b border-[var(--hair)] px-6 py-3 flex items-center gap-3 shrink-0"
      style="background: rgba(13, 25, 45, 0.5); backdrop-filter: blur(8px)"
    >
      <span class="kicker">— Map</span>
      <span class="display-sm text-[var(--accent)]">Utah Startup Map</span>
    </header>
    <main class="flex flex-1 min-h-0 overflow-hidden pb-6">
      <div :class="mapZoneClasses">
        <div class="relative flex-1 min-h-0" @click="handleMapBackgroundClick">
          <UtahMap class="w-full h-full" />
          <div class="absolute top-4 left-4 right-4 bottom-0 z-20 flex items-stretch gap-3 pointer-events-none">
            <FilterSidebar class="pointer-events-auto" />
            <div class="flex-1 flex flex-col justify-end items-start min-w-0 pointer-events-none">
              <EcosystemStatsBar class="pointer-events-auto" />
            </div>
          </div>
          <CompanyDrawer />
        </div>
      </div>
    </main>
    <SubscribeCTA />
  </div>
</template>

<style scoped>
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
header {
  animation: fadeSlideIn 0.5s ease-out both;
}
main {
  animation: fadeSlideIn 0.65s ease-out both;
}
</style>
