<script setup>
import { ref, computed, watch, reactive, onMounted, nextTick } from 'vue'
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

const filterStage    = ref(quizState.stage    ? [quizState.stage]    : [])
const filterIndustry = ref(quizState.industry ? [quizState.industry] : [])
const filterTopic    = ref(quizState.topic    ? [quizState.topic]    : [])
const filterRegion   = ref(quizState.region   ? [quizState.region]   : [])
const filterType     = ref([])

const filtersOpen = reactive({
  stage:    !!quizState.stage,
  industry: !!quizState.industry,
  need:     !!quizState.topic,
  region:   !!quizState.region,
  type:     false,
})

const PAGE_SIZE = 15
const page = ref(1)

function resetPage() { page.value = 1 }

watch([filterStage, filterIndustry, filterTopic, filterRegion, filterType], resetPage, { deep: true })

onMounted(async () => {
  results.value = await scoreQuiz({ ...quizState })
  loading.value = false
  await nextTick()
  gsap.fromTo('[data-anim="result-row"]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.04 })
})

const filteredResults = computed(() => {
  let list = results.value
  if (filterStage.value.length)
    list = list.filter(r => r.tags.stage.includes('any') || filterStage.value.some(s => r.tags.stage.includes(s)))
  if (filterIndustry.value.length)
    list = list.filter(r => r.tags.industry.includes('general') || filterIndustry.value.some(ind => r.tags.industry.includes(ind)))
  if (filterTopic.value.length)
    list = list.filter(r => r.tags.goal.includes('any') || filterTopic.value.some(t => r.tags.goal.includes(t)))
  if (filterRegion.value.length)
    list = list.filter(r => r.tags.region.includes('statewide') || filterRegion.value.some(reg => r.tags.region.includes(reg)))
  if (filterType.value.length)
    list = list.filter(r => filterType.value.some(t => r.tags.resource_type.includes(t)))
  return list
})

const totalPages = computed(() => Math.ceil(filteredResults.value.length / PAGE_SIZE))

const visibleResults = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredResults.value.slice(start, start + PAGE_SIZE)
})

const maxScore = computed(() => Math.max(245, ...results.value.map(r => r.score)))

const hasActiveFilters = computed(() =>
  filterStage.value.length || filterIndustry.value.length ||
  filterTopic.value.length || filterRegion.value.length || filterType.value.length
)

function toggle(arr, id) {
  const idx = arr.indexOf(id)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(id)
}

function clearAll() {
  filterStage.value = []
  filterIndustry.value = []
  filterTopic.value = []
  filterRegion.value = []
  filterType.value = []
}

function retake() {
  quizState.stage = null
  quizState.industry = null
  quizState.topic = null
  quizState.region = null
  router.push('/')
}

function typeLabel(slug)     { return RESOURCE_TYPE_LABELS[slug] ?? slug }
function regionLabel(slug)   { return REGION_LABELS[slug] ?? slug }
function stageLabel(slug)    { return STAGE_OPTIONS.find(o => o.id === slug)?.title ?? slug }
function industryLabel(slug) { return INDUSTRY_OPTIONS.find(o => o.id === slug)?.title ?? slug }
function topicLabel(slug)    { return TOPIC_OPTIONS.find(o => o.id === slug)?.title ?? slug }
</script>

<template>
  <section class="flex-1">
    <div class="px-[var(--pad)] pt-10 pb-6">
      <div class="idx">— 03 / Matches</div>
      <div class="flex items-start justify-between mt-6 gap-4 flex-wrap">
        <h2 class="display-md max-w-[20ch]">{{ filteredResults.length }} resources, ranked for you.</h2>
        <button class="btn-text" @click="retake()">← Retake quiz</button>
      </div>

      <!-- filter accordions -->
      <div class="filter-accordions mt-8">

        <!-- Stage -->
        <div class="filter-group">
          <button class="filter-group-head" @click="filtersOpen.stage = !filtersOpen.stage">
            <div class="flex items-center gap-3">
              <span class="kicker kicker-ink">Stage</span>
              <span v-if="filterStage.length" class="filter-count">{{ filterStage.length }}</span>
            </div>
            <span class="filter-chevron" :class="{ 'is-open': filtersOpen.stage }">▾</span>
          </button>
          <div v-show="filtersOpen.stage" class="filter-group-body">
            <button class="chip" :class="{ 'is-active': filterStage.length === 0 }" @click="filterStage.splice(0)">All</button>
            <button v-for="s in STAGE_OPTIONS" :key="s.id" class="chip"
                    :class="{ 'is-active': filterStage.includes(s.id) }"
                    @click="toggle(filterStage, s.id)">{{ s.title }}</button>
          </div>
        </div>

        <!-- Industry -->
        <div class="filter-group">
          <button class="filter-group-head" @click="filtersOpen.industry = !filtersOpen.industry">
            <div class="flex items-center gap-3">
              <span class="kicker kicker-ink">Industry</span>
              <span v-if="filterIndustry.length" class="filter-count">{{ filterIndustry.length }}</span>
            </div>
            <span class="filter-chevron" :class="{ 'is-open': filtersOpen.industry }">▾</span>
          </button>
          <div v-show="filtersOpen.industry" class="filter-group-body">
            <button class="chip" :class="{ 'is-active': filterIndustry.length === 0 }" @click="filterIndustry.splice(0)">All</button>
            <button v-for="o in INDUSTRY_OPTIONS" :key="o.id" class="chip"
                    :class="{ 'is-active': filterIndustry.includes(o.id) }"
                    @click="toggle(filterIndustry, o.id)">{{ o.title }}</button>
          </div>
        </div>

        <!-- Need -->
        <div class="filter-group">
          <button class="filter-group-head" @click="filtersOpen.need = !filtersOpen.need">
            <div class="flex items-center gap-3">
              <span class="kicker kicker-ink">Need</span>
              <span v-if="filterTopic.length" class="filter-count">{{ filterTopic.length }}</span>
            </div>
            <span class="filter-chevron" :class="{ 'is-open': filtersOpen.need }">▾</span>
          </button>
          <div v-show="filtersOpen.need" class="filter-group-body">
            <button class="chip" :class="{ 'is-active': filterTopic.length === 0 }" @click="filterTopic.splice(0)">All</button>
            <button v-for="o in TOPIC_OPTIONS" :key="o.id" class="chip"
                    :class="{ 'is-active': filterTopic.includes(o.id) }"
                    @click="toggle(filterTopic, o.id)">{{ o.title }}</button>
          </div>
        </div>

        <!-- Region -->
        <div class="filter-group">
          <button class="filter-group-head" @click="filtersOpen.region = !filtersOpen.region">
            <div class="flex items-center gap-3">
              <span class="kicker kicker-ink">Region</span>
              <span v-if="filterRegion.length" class="filter-count">{{ filterRegion.length }}</span>
            </div>
            <span class="filter-chevron" :class="{ 'is-open': filtersOpen.region }">▾</span>
          </button>
          <div v-show="filtersOpen.region" class="filter-group-body">
            <button class="chip" :class="{ 'is-active': filterRegion.length === 0 }" @click="filterRegion.splice(0)">All</button>
            <button v-for="o in REGION_OPTIONS" :key="o.id" class="chip"
                    :class="{ 'is-active': filterRegion.includes(o.id) }"
                    @click="toggle(filterRegion, o.id)">{{ o.title }}</button>
          </div>
        </div>

        <!-- Resource Type — last -->
        <div class="filter-group">
          <button class="filter-group-head" @click="filtersOpen.type = !filtersOpen.type">
            <div class="flex items-center gap-3">
              <span class="kicker kicker-ink">Resource Type</span>
              <span v-if="filterType.length" class="filter-count">{{ filterType.length }}</span>
            </div>
            <span class="filter-chevron" :class="{ 'is-open': filtersOpen.type }">▾</span>
          </button>
          <div v-show="filtersOpen.type" class="filter-group-body">
            <button class="chip" :class="{ 'is-active': filterType.length === 0 }" @click="filterType.splice(0)">All</button>
            <button v-for="(label, key) in RESOURCE_TYPE_LABELS" :key="key" class="chip"
                    :class="{ 'is-active': filterType.includes(key) }"
                    @click="toggle(filterType, key)">{{ label }}</button>
          </div>
        </div>

      </div>

      <div class="mt-3 flex items-center justify-between">
        <button v-if="hasActiveFilters" class="btn-text" @click="clearAll()">Clear all filters</button>
        <span v-else></span>
        <span class="kicker">Sorted by match</span>
      </div>

      <hr class="hr-thin mt-4" />
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
              <span v-for="t in r.tags.resource_type" :key="'rt-'+t" class="badge-cat accent">{{ typeLabel(t) }}</span>
              <span v-for="s in r.tags.stage.filter(s => s !== 'any')" :key="'st-'+s" class="badge-cat">{{ stageLabel(s) }}</span>
              <span v-for="ind in r.tags.industry.filter(i => i !== 'general')" :key="'ind-'+ind" class="badge-cat">{{ industryLabel(ind) }}</span>
              <span v-for="g in r.tags.goal.filter(g => g !== 'any')" :key="'g-'+g" class="badge-cat">{{ topicLabel(g) }}</span>
              <span v-for="reg in r.tags.region.filter(r => r !== 'statewide')" :key="'reg-'+reg" class="badge-cat outline">{{ regionLabel(reg) }}</span>
            </div>
            <h3 class="display-sm">{{ r.name }}</h3>
            <p class="mt-2 text-[15px]" style="color:var(--fg-2); max-width:70ch;">{{ r.summary }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span v-for="reg in r.tags.region.slice(0, 4)" :key="reg" class="county-tag">{{ regionLabel(reg) }}</span>
            </div>
          </div>
          <div class="hidden md:flex col-span-4 flex-col items-end gap-2 pt-2">
            <div v-if="r.score > 0" class="score">
              <span>match</span>
              <span class="bar" :style="{ '--w': Math.min(100, (r.score / maxScore) * 100) + '%' }"></span>
              <span style="color:var(--fg); font-weight:500;">{{ r.score }}</span>
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

<style scoped>
.filter-accordions {
  border: 1px solid var(--hair);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}
.filter-group { border-bottom: 1px solid var(--hair); }
.filter-group:last-child { border-bottom: 0; }
.filter-group-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.1rem;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--fg);
  transition: background .15s;
}
.filter-group-head:hover { background: var(--surface-2); }
.filter-group-body {
  padding: 0.75rem 1.1rem 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  border-top: 1px solid var(--hair);
}
.filter-chevron {
  font-size: 14px;
  color: var(--fg-3);
  transition: transform .2s ease;
  display: inline-block;
  line-height: 1;
}
.filter-chevron.is-open { transform: rotate(180deg); }
.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--accent);
  color: #07140A;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
}
</style>
