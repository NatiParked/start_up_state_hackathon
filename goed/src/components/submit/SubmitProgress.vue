<script setup>
import { computed, onMounted, watch } from 'vue'
import gsap from 'gsap'

const props = defineProps({
  stage: { type: String, default: 'idle' },
})

const STAGES = [
  { key: 'scrape', label: 'Reading your website…' },
  { key: 'crunchbase', label: 'Checking Crunchbase investors…' },
  { key: 'dcc', label: 'Verifying Utah registration…' },
  { key: 'ats', label: 'Scanning job postings…' },
  { key: 'logo', label: 'Fetching logo…' },
  { key: 'geocode', label: 'Geocoding address…' },
  { key: 'publish', label: 'Publishing to map…' },
]

const activeIndex = computed(() => {
  const idx = STAGES.findIndex((s) => s.key === props.stage)
  return idx === -1 ? -1 : idx
})

const progressPercent = computed(() => {
  if (activeIndex.value === -1) return 0
  return Math.round(((activeIndex.value + 1) / STAGES.length) * 100)
})

const stageStates = computed(() =>
  STAGES.map((s, i) => {
    let status = 'upcoming'
    if (i < activeIndex.value) status = 'complete'
    else if (i === activeIndex.value) status = 'active'
    return { key: s.key, label: s.label, status }
  }),
)

function animateProgress() {
  gsap.to('.submit-progress-bar', {
    width: `${progressPercent.value}%`,
    duration: 0.6,
    ease: 'power2.out',
  })
}

onMounted(() => {
  gsap.from('.submit-stage-item', {
    opacity: 0,
    y: 10,
    stagger: 0.08,
    duration: 0.4,
    ease: 'power2.out',
  })
  animateProgress()
})

watch(() => props.stage, animateProgress)
</script>

<template>
  <div class="py-4">
    <h2 class="text-lg font-semibold text-utah-blue mb-4">Analyzing your startup…</h2>

    <div class="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
      <div class="submit-progress-bar h-full bg-utah-blue rounded-full" style="width: 0%"></div>
    </div>

    <ul class="space-y-3">
      <li
        v-for="item in stageStates"
        :key="item.key"
        class="submit-stage-item flex items-center gap-3"
      >
        <span v-if="item.status === 'complete'" class="flex-shrink-0 w-5 h-5 text-utah-blue">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </span>
        <span
          v-if="item.status === 'active'"
          class="flex-shrink-0 w-5 h-5 border-2 border-utah-blue border-t-transparent rounded-full animate-spin"
        ></span>
        <span
          v-if="item.status === 'upcoming'"
          class="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300"
        ></span>

        <span
          v-if="item.status === 'complete'"
          class="text-sm font-medium text-gray-800"
        >{{ item.label }}</span>
        <span
          v-if="item.status === 'active'"
          class="text-sm font-semibold text-utah-blue"
        >{{ item.label }}</span>
        <span
          v-if="item.status === 'upcoming'"
          class="text-sm text-gray-400"
        >{{ item.label }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped></style>
