<script setup>
import { computed } from 'vue'
import { useLogoDev } from '@/composables/useLogoDev'

const props = defineProps({
  companies: { type: Array, required: true },
  count: { type: Number, required: true },
})

const { getLogoUrl } = useLogoDev()

const displayCount = computed(() => (props.count > 99 ? '99+' : String(props.count)))

const previewCompanies = computed(() => props.companies.slice(0, 3))

const previewLogoUrls = computed(() =>
  previewCompanies.value.map((company) => ({
    id: company.id,
    url: getLogoUrl(company.website),
    name: company.name,
  })),
)

const clusterClasses = computed(
  () =>
    'w-11 h-11 rounded-full bg-[var(--accent)] text-[#07140A] font-bold text-sm ' +
    'flex items-center justify-center ' +
    'ring-2 ring-white shadow-lg cursor-pointer ' +
    'hover:scale-105 transition-transform duration-150',
)

const previewWrapperClasses = computed(
  () =>
    'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ' +
    'flex gap-1 ' +
    'opacity-0 group-hover:opacity-100 ' +
    'translate-y-1 group-hover:translate-y-0 ' +
    'transition-all duration-200 pointer-events-none',
)

const logoCircleClasses = computed(
  () => 'w-7 h-7 rounded-full bg-white ring-1 ring-[var(--accent)]/30 overflow-hidden flex items-center justify-center flex-shrink-0',
)

const monogramClasses = computed(
  () => 'w-full h-full flex items-center justify-center bg-[var(--accent)] text-[#07140A] text-xs font-semibold',
)
</script>

<template>
  <div class="group relative inline-block">
    <div :class="previewWrapperClasses">
      <div
        v-for="item in previewLogoUrls"
        :key="item.id"
        :class="logoCircleClasses"
      >
        <img
          v-if="item.url !== null"
          :src="item.url"
          alt=""
          loading="lazy"
          class="w-full h-full object-cover"
        />
        <span v-else :class="monogramClasses">{{ item.name?.charAt(0) }}</span>
      </div>
    </div>
    <div :class="clusterClasses">
      {{ displayCount }}
    </div>
  </div>
</template>

<style scoped></style>
