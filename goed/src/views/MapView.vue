<script setup>
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useRoute } from "vue-router";
import { useStartupsStore } from "@/stores/startups";
import UtahMap from "@/components/map/UtahMap.vue";
import EcosystemStatsBar from "@/components/map/EcosystemStatsBar.vue";
import CompanyDrawer from "@/components/drawer/CompanyDrawer.vue";
import FilterSidebar from "@/components/filters/FilterSidebar.vue";
import SubscribeCTA from "@/components/map/SubscribeCTA.vue";

const store = useStartupsStore();
const { companies } = storeToRefs(store);
const { clearSelection, selectCompany } = store;
const route = useRoute();

const layoutClasses = computed(
  () => "flex flex-col flex-1 min-h-0 w-full overflow-hidden",
);
const mapZoneClasses = computed(
  () => "flex flex-col flex-1 min-w-0 min-h-0 relative",
);

function handleMapBackgroundClick() {
  clearSelection();
}

onMounted(async () => {
  if (companies.value.length === 0) {
    await store.fetchAll();
  }
  const requestedId = route.query.company;
  if (typeof requestedId === "string" && requestedId.length > 0) {
    const match = companies.value.find((c) => c.id === requestedId);
    if (match) {
      selectCompany(requestedId);
    }
  }
});
</script>

<template>
  <div :class="layoutClasses">
    <header
      class="border-b border-[var(--hair)] px-6 flex items-center gap-6 shrink-0 h-[72px]"
      style="background: rgba(13, 25, 45, 0.5); backdrop-filter: blur(8px)"
    >
      <div class="flex items-center gap-3 shrink-0">
        <span class="kicker">— Map</span>
        <span class="display-sm text-[var(--accent)]">Utah Startup Map</span>
      </div>
      <span class="self-stretch w-px shrink-0 my-4" style="background: var(--hair-2);"></span>
      <EcosystemStatsBar class="flex-1 min-w-0" />
      <RouterLink to="/submit" class="btn btn-primary py-[0.535rem] shrink-0">
        Add Your Startup
        <span class="arrow" aria-hidden="true">→</span>
      </RouterLink>
    </header>
    <main class="flex flex-1 min-h-0 overflow-hidden pb-6">
      <div :class="mapZoneClasses">
        <div class="relative flex-1 min-h-0" @click="handleMapBackgroundClick">
          <UtahMap class="w-full h-full" />
          <FilterSidebar class="absolute top-4 left-4 bottom-0 z-20 pointer-events-auto" />
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
