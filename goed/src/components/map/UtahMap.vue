<script setup>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'
import CompanyPin from '@/components/map/CompanyPin.vue'

const UTAH_CENTER = [-111.525, 40.65]
const UTAH_ZOOM = 7

const store = useStartupsStore()
const { filteredCompanies, selectedCompany } = storeToRefs(store)
const { selectCompany, clearSelection } = store

const mapRef = ref(null)

const pinnableCompanies = computed(() =>
  filteredCompanies.value.filter(
    c => Number.isFinite(c.lat) && Number.isFinite(c.lng),
  ),
)
const initialCenter = computed(() => UTAH_CENTER)
const initialZoom = computed(() => UTAH_ZOOM)

function handleSelect(event) {
  const selected = event.selected
  if (selected && selected.length > 0) {
    const feature = selected[0]
    const id = feature.get('companyId')
    if (id != null) selectCompany(id)
  } else {
    clearSelection()
  }
}

onMounted(() => {
  // Map auto-centers via :center and :zoom bindings; no fitToUtah needed
})
</script>

<template>
  <div class="relative w-full h-full">
    <ol-map ref="mapRef" class="w-full h-full">
      <ol-view :center="initialCenter" :zoom="initialZoom" projection="EPSG:4326" />
      <ol-tile-layer>
        <ol-source-osm />
      </ol-tile-layer>
      <ol-vector-layer>
        <ol-source-vector>
          <ol-feature
            v-for="company in pinnableCompanies"
            :key="company.id"
            :properties="{ companyId: company.id }"
          />
        </ol-source-vector>
      </ol-vector-layer>
      <ol-overlay
        v-for="company in pinnableCompanies"
        :key="'overlay-' + company.id"
        :position="[company.lng, company.lat]"
        positioning="center-center"
      >
        <CompanyPin :company="company" />
      </ol-overlay>
      <ol-interaction-select @select="handleSelect" />
    </ol-map>
  </div>
</template>

<style scoped></style>
