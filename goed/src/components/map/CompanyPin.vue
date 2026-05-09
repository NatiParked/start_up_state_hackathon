<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogoDev } from '@/composables/useLogoDev'
import { useStartupsStore } from '@/stores/startups'

const props = defineProps({
  company: { type: Object, required: true },
})

const { getLogoUrl } = useLogoDev()
const store = useStartupsStore()
const { selectedCompany } = storeToRefs(store)
const { selectCompany } = store

const hasError = ref(false)

const logoUrl = computed(() => getLogoUrl(props.company.website))
const monogram = computed(() => props.company.name?.charAt(0).toUpperCase() ?? '')
const showMonogram = computed(() => logoUrl.value === null || hasError.value)
const isActive = computed(() => selectedCompany.value?.id === props.company.id)
const pinClasses = computed(() => {
  const base = 'w-9 h-9 rounded-full overflow-hidden border-2 shadow-md cursor-pointer transition-transform duration-150 flex items-center justify-center'
  return isActive.value
    ? `${base} border-utah-blue ring-2 ring-utah-blue scale-110 shadow-lg`
    : `${base} border-white`
})
const monogramClasses = computed(() => 'w-full h-full flex items-center justify-center bg-utah-blue text-white text-sm font-bold')
</script>

<template>
  <div :class="pinClasses" @click="selectCompany(company.id)">
    <img
      v-if="!showMonogram"
      :src="logoUrl"
      :alt="company.name"
      class="w-full h-full object-cover"
      @error="hasError = true"
    />
    <span v-else :class="monogramClasses">{{ monogram }}</span>
  </div>
</template>

<style scoped></style>
