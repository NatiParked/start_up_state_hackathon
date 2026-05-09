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
  const base = 'w-10 h-10 rounded-full overflow-hidden cursor-pointer transition-all duration-150 ease-out flex items-center justify-center'
  const shadow = isActive.value ? 'shadow-xl' : 'shadow-md hover:shadow-lg'
  const ring = isActive.value ? 'ring-4 ring-utah-blue' : 'ring-2 ring-white hover:scale-110 active:scale-95'
  const scale = isActive.value ? 'scale-110' : ''
  return `${base} ${shadow} ${ring} ${scale}`
})

const monogramClasses = computed(() => 'w-full h-full flex items-center justify-center bg-utah-blue text-white text-sm font-bold')
</script>

<template>
  <div :class="pinClasses" @click.stop="selectCompany(company.id)">
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
