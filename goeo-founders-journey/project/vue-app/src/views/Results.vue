<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import {
  scoreQuiz, getResources,
  STAGE_OPTIONS, INDUSTRY_OPTIONS, TOPIC_OPTIONS, REGION_OPTIONS,
  RESOURCE_TYPE_LABELS, REGION_LABELS
} from '../api'
import { quizState } from '../state/quiz'

const router = useRouter()
const results = ref([])
const loading = ref(true)

const filterStage    = ref(quizState.stage)
const filterIndustry = ref(quizState.industry)
const filterTopic    = ref(quizState.topic)
const filterRegion   = ref(quizState.region)

const PAGE_SIZE = 15
const page = ref(1)

function resetPage() { page.value = 1 }

watch([filterStage, filterIndustry, filterTopic, filterRegion], resetPage)

onMounted(async () => {
  results.value = await scoreQuiz({ ...quizState })
  loading.value = false
  await nextTick()
  gsap.fromTo('[data-anim="result-row"]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.04 })
})

const filteredResults = computed(() => {
  let list = results.value
  if (filterStage.value)    list = list.filter(r => r.tags.stage.includes('any') || r.tags.stage.includes(filterStage.value))
  if (filterIndustry.value) list = list.filter(r => r.tags.industry.includes(filterIndustry.value))
  if (filterTopic.value)    list = list.filter(r => r.tags.goal.includes(filterTopic.value))
  if (filterRegion.value)   list = list.filter(r => r.tags.region.includes('statewide') || r.tags.region.includes(filterRegion.value))
  return list
})

const totalPages = computed(() => Math.ceil(filteredResults.value.length / PAGE_SIZE))

const visibleResults = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredResults.value.slice(start, start + PAGE_SIZE)
})

const maxScore = computed(() => Math.max(245, ...results.value.map(r => r.score)))

function retake() {
  quizState.stage = null
  quizState.industry = null
  quizState.topic = null
  quizState.region = null
  router.push('/')
}

function typeLabel(slug) { return RESOURCE_TYPE_LABELS[slug] ?? slug }
function regionLabel(slug) { return REGION_LABELS[slug] ?? slug }
</script>

<template>
  <section class="flex-1">
    <div class="px-[var(--pad)] pt-10 pb-6">
      <div class="idx">— 03 / Matches</div>
      <div class="flex items-start justify-between mt-6 gap-4 flex-wrap">
        <h2 class="display-md max-w-[20ch]">{{ filteredResults.length }} resources, ranked for you.</h2>
        <button class="btn-text" @click="retake()">← Retake quiz</button>
      </div>

      <div class="mt-8 flex flex-wrap items-center gap-2">
        <span class="kicker mr-3">Stage</span>
        <button class="chip" :class="{ 'is-active': !filterStage }" @click="filterStage = null">All</button>
        <button v-for="s in STAGE_OPTIONS" :key="s.id" class="chip" :class="{ 'is-active': filterStage === s.id }" @click="filterStage = filterStage === s.id ? null : s.id">{{ s.title }}</button>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span class="kicker mr-3">Industry</span>
        <button class="chip" :class="{ 'is-active': !filterIndustry }" @click="filterIndustry = null">All</button>
        <button v-for="o in INDUSTRY_OPTIONS" :key="o.id" class="chip" :class="{ 'is-active': filterIndustry === o.id }" @click="filterIndustry = filterIndustry === o.id ? null : o.id">{{ o.title }}</button>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span class="kicker mr-3">Need</span>
        <button class="chip" :class="{ 'is-active': !filterTopic }" @click="filterTopic = null">All</button>
        <button v-for="o in TOPIC_OPTIONS" :key="o.id" class="chip" :class="{ 'is-active': filterTopic === o.id }" @click="filterTopic = filterTopic === o.id ? null : o.id">{{ o.title }}</button>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span class="kicker mr-3">Region</span>
        <button class="chip" :class="{ 'is-active': !filterRegion }" @click="filterRegion = null">All</button>
        <button v-for="o in REGION_OPTIONS" :key="o.id" class="chip" :class="{ 'is-active': filterRegion === o.id }" @click="filterRegion = filterRegion === o.id ? null : o.id">{{ o.title }}</button>
      </div>
      <hr class="hr-thin mt-6" />
    </div>

    <div class="px-[var(--pad)] pb-24">
      <div v-if="loading" class="py-20 text-center kicker">Loading…</div>
      <ul v-else class="flex flex-col">
        <li v-for="(r, i) in visibleResults" :key="r.id" data-anim="result-row"
            class="cursor-pointer border-b border-[var(--hair)] py-7 grid grid-cols-12 gap-6 items-baseline"
            @click="router.push('/resource/' + r.id)">
          <div class="col-span-1 foot-mark pt-2">{{ String(i + 1).padStart(2, '0') }}</div>
          <div class="col-span-11 md:col-span-7">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span v-for="t in r.tags.resource_type.slice(0, 2)" :key="t" class="badge-cat">{{ typeLabel(t) }}</span>
            </div>
            <h3 class="display-sm">{{ r.name }}</h3>
            <p class="mt-2 text-[15px]" style="color:var(--text-2); max-width:70ch;">{{ r.summary }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span v-for="reg in r.tags.region.slice(0, 4)" :key="reg" class="county-tag">{{ regionLabel(reg) }}</span>
            </div>
          </div>
          <div class="hidden md:flex col-span-4 flex-col items-end gap-2 pt-2">
            <div v-if="r.score > 0" class="score">
              <span>match</span>
              <span class="bar" :style="{ '--w': Math.min(100, (r.score / maxScore) * 100) + '%' }"></span>
              <span style="color:var(--ink); font-weight:500;">{{ r.score }}</span>
            </div>
          </div>
        </li>
      </ul>
      <div v-if="totalPages > 1" class="flex items-center justify-between pt-10 pb-4">
        <button class="btn btn-ghost" :disabled="page === 1" @click="page--">← Prev</button>
        <span class="kicker">{{ page }} / {{ totalPages }}</span>
        <button class="btn btn-ghost" :disabled="page === totalPages" @click="page++">Next →</button>
      </div>
    </div>
  </section>
</template>
