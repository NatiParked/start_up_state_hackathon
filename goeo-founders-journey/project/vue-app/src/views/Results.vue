<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import { scoreQuiz, getResources, STAGE_OPTIONS, INDUSTRY_OPTIONS, TOPIC_OPTIONS } from '../api'
import { quizState } from '../state/quiz'

const router = useRouter()
const results = ref([])
const loading = ref(true)
const filterIndustry = ref(quizState.industry)
const filterTopic = ref(quizState.topic)
const filterStage = ref(quizState.stage)

onMounted(async () => {
  if (quizState.stage || quizState.industry || quizState.topic) {
    results.value = await scoreQuiz({ ...quizState })
  } else {
    const all = await getResources()
    results.value = all.map(x => ({ ...x, score: 0, reasons: [] })).sort((a,b)=>a.title.localeCompare(b.title)).slice(0, 60)
  }
  loading.value = false
  await nextTick()
  gsap.fromTo('[data-anim="result-row"]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.04 })
})

const visibleResults = computed(() => {
  let list = results.value
  const ind = INDUSTRY_OPTIONS.find(o => o.id === filterIndustry.value)?.match
  const top = TOPIC_OPTIONS.find(o => o.id === filterTopic.value)?.match
  if (ind) list = list.filter(r => r.industries.includes(ind))
  if (top) list = list.filter(r => r.topics.includes(top))
  return list
})
const maxScore = computed(() => Math.max(245, ...results.value.map(r => r.score)))
function truncate(s, n) { if (!s) return ''; if (s.length <= n) return s; const cut = s.slice(0, n); return cut.slice(0, cut.lastIndexOf(' ')) + '…' }
</script>

<template>
  <section class="flex-1">
    <div class="px-[var(--pad)] pt-10 pb-6">
      <div class="idx">— 03 / Matches</div>
      <h2 class="display-md mt-6 max-w-[20ch]">{{ visibleResults.length }} resources, ranked for you.</h2>

      <div class="mt-8 flex flex-wrap items-center gap-2">
        <span class="kicker mr-3">Stage</span>
        <button class="chip" :class="{ 'is-active': !filterStage }" @click="filterStage = null">All stages</button>
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
              <span v-for="t in r.topics.slice(0, 2)" :key="t" class="badge-cat">{{ t }}</span>
              <span v-if="r.communities[0]" class="badge-cat outline">{{ r.communities[0] }}</span>
            </div>
            <h3 class="display-sm">{{ r.title }}</h3>
            <p class="mt-2 text-[15px]" style="color:var(--text-2); max-width:70ch;">{{ truncate(r.description, 200) }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span v-for="loc in r.locations.slice(0, 4)" :key="loc" class="county-tag">{{ loc }}</span>
              <span v-if="r.locations.length > 4" class="county-tag">+{{ r.locations.length - 4 }}</span>
            </div>
          </div>
          <div class="hidden md:flex col-span-4 flex-col items-end gap-2 pt-2">
            <div class="score">
              <span>match</span>
              <span class="bar" :style="{ '--w': Math.min(100, (r.score / maxScore) * 100) + '%' }"></span>
              <span style="color:var(--ink); font-weight:500;">{{ r.score }}</span>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
