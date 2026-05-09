<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStartupsStore } from '@/stores/startups'
import CompanyPin from '@/components/map/CompanyPin.vue'
import PinCluster from '@/components/map/PinCluster.vue'
import { createClusterStyle } from '@/lib/clusterStyle'

const UTAH_CENTER = [-111.525, 40.65]
const UTAH_ZOOM = 7
const CLUSTER_THRESHOLD = 7

const store = useStartupsStore()
const { companies, filteredCompanies, selectedCompany } = storeToRefs(store)
const { selectCompany, clearSelection } = store

const mapRef = ref(null)
const viewRef = ref(null)
const currentZoom = ref(UTAH_ZOOM)
const hoveredClusterCompanies = ref([])
const hoveredClusterPosition = ref(null)

const allPinnableCompanies = computed(() =>
  companies.value.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng)),
)

const filteredIds = computed(() => new Set(filteredCompanies.value.map(c => c.id)))

const pinnableCompanies = computed(() =>
  filteredCompanies.value.filter(
    c => Number.isFinite(c.lat) && Number.isFinite(c.lng),
  ),
)

const initialCenter = computed(() => UTAH_CENTER)
const initialZoom = computed(() => UTAH_ZOOM)

const showIndividualPins = computed(() => currentZoom.value >= CLUSTER_THRESHOLD)

const showClusterPreview = computed(
  () => hoveredClusterCompanies.value.length > 0 && hoveredClusterPosition.value !== null,
)

function onMoveEnd() {
  const view = viewRef.value?.view ?? mapRef.value?.map?.getView()
  if (!view) return
  currentZoom.value = view.getZoom() ?? UTAH_ZOOM
}

function handleSelect(event) {
  const selected = event.selected
  if (!selected || selected.length === 0) {
    clearSelection()
    return
  }
  const feature = selected[0]
  const children = feature.get('features') || []
  if (children.length > 1) {
    const view = viewRef.value?.view ?? mapRef.value?.map?.getView()
    if (view) {
      view.animate({
        zoom: (view.getZoom() ?? UTAH_ZOOM) + 2,
        center: feature.getGeometry().getCoordinates(),
        duration: 350,
      })
    }
    return
  }
  const id = children[0]?.get('companyId') ?? feature.get('companyId')
  if (id != null) selectCompany(id)
}

function onPointerMove(event) {
  const map = event.map ?? mapRef.value?.map
  if (!map) return
  let foundCluster = false
  map.forEachFeatureAtPixel(event.pixel, (feature) => {
    if (foundCluster) return
    const children = feature.get('features')
    if (children && children.length > 1) {
      hoveredClusterCompanies.value = children.map(f => {
        const id = f.get('companyId')
        return companies.value.find(c => c.id === id)
      }).filter(Boolean)
      hoveredClusterPosition.value = feature.getGeometry().getCoordinates()
      foundCluster = true
    }
  }, { hitTolerance: 5 })
  if (!foundCluster) {
    hoveredClusterCompanies.value = []
    hoveredClusterPosition.value = null
  }
}
</script>

<template>
  <div class="relative w-full h-full">
    <ol-map ref="mapRef" class="w-full h-full" @moveend="onMoveEnd" @pointermove="onPointerMove">
      <ol-view ref="viewRef" :center="initialCenter" :zoom="initialZoom" projection="EPSG:4326" />
      <ol-tile-layer>
        <ol-source-osm />
      </ol-tile-layer>
      <ol-vector-layer :style-function="createClusterStyle" :visible="!showIndividualPins">
        <ol-source-cluster :distance="40">
          <ol-source-vector>
            <ol-feature
              v-for="company in pinnableCompanies"
              :key="company.id"
              :properties="{ companyId: company.id }"
            >
              <ol-geom-point :coordinates="[company.lng, company.lat]" />
            </ol-feature>
          </ol-source-vector>
        </ol-source-cluster>
      </ol-vector-layer>
      <ol-overlay
        v-for="company in allPinnableCompanies"
        :key="'overlay-' + company.id"
        :position="[company.lng, company.lat]"
        positioning="center-center"
      >
        <CompanyPin
          v-show="filteredIds.has(company.id) && showIndividualPins"
          :company="company"
        />
      </ol-overlay>
      <ol-overlay
        v-if="showClusterPreview"
        :position="hoveredClusterPosition"
        positioning="center-center"
        class="pointer-events-none z-20"
      >
        <PinCluster :companies="hoveredClusterCompanies" :count="hoveredClusterCompanies.length" />
      </ol-overlay>
      <ol-interaction-select @select="handleSelect" />
    </ol-map>
  </div>
</template>

<style scoped></style>
