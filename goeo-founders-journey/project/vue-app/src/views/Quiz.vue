<script setup>
import { ref, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import { STAGE_OPTIONS, INDUSTRY_OPTIONS, TOPIC_OPTIONS } from '../api'
import { quizState } from '../state/quiz'

const router = useRouter()
const step = ref(0)
const steps = [
  { key: 'stage', title: 'What stage is your company?', sub: 'This helps us personalize. There are no wrong answers.', options: STAGE_OPTIONS },
  { key: 'industry', title: 'What industry are you building in?', sub: 'Pick the closest fit — we lean towards specificity.', options: INDUSTRY_OPTIONS },
  { key: 'topic', title: 'What do you need most right now?', sub: 'One thing. We rank everything else around it.', options: TOPIC_OPTIONS },
]

function advance(then, dir = 1) {
  const el = document.querySelector('[data-anim="quiz-card"]')
  gsap.to(el, {
    opacity: 0, y: dir > 0 ? -16 : 16, duration: 0.22, ease: 'power2.in',
    onComplete: async () => {
      then()
      await nextTick()
      gsap.fromTo('[data-anim="quiz-card"]', { opacity: 0, y: dir > 0 ? 24 : -24 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' })
      gsap.fromTo('[data-anim="quiz-opt"]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.05, delay: 0.1 })
    }
  })
}

function pick(val) {
  const k = steps[step.value].key
  quizState[k] = val
  advance(() => {
    if (step.value < steps.length - 1) step.value++
    else router.push('/results')
  })
}

function skip() { advance(() => step.value < steps.length - 1 ? step.value++ : router.push('/results')) }
function back() {
  if (step.value > 0) advance(() => step.value--, -1)
  else router.push('/')
}
</script>

<template>
  <section class="flex-1 flex flex-col">
    <div class="px-[var(--pad)] pt-6">
      <div class="flex items-center justify-between mb-3">
        <button class="btn-text" @click="back()">← Back</button>
        <div class="kicker">Question {{ step + 1 }} / {{ steps.length }}</div>
      </div>
      <div class="progress-rail" :style="{ '--p': ((step + 1) / steps.length * 100) + '%' }"></div>
    </div>

    <div class="stage" data-anim="quiz-card">
      <div class="max-w-[1100px] mx-auto w-full">
        <div class="idx mb-6">— 0{{ step + 1 }} / {{ steps[step].key }}</div>
        <h2 class="display-md max-w-[18ch]">{{ steps[step].title }}</h2>
        <p class="lede mt-4">{{ steps[step].sub }}</p>
        <div class="grid sm:grid-cols-2 gap-4 mt-12">
          <button v-for="(o, i) in steps[step].options" :key="o.id"
                  data-anim="quiz-opt" class="opt"
                  :class="{ 'is-selected': quizState[steps[step].key] === o.id }"
                  @click="pick(o.id)">
            <div class="flex items-baseline justify-between">
              <span class="opt-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="opt-num arrow">→</span>
            </div>
            <div class="opt-title">{{ o.title }}</div>
            <div class="opt-sub">{{ o.sub }}</div>
          </button>
        </div>
        <div class="mt-10 flex items-center justify-between">
          <button class="btn-text" @click="skip()">Skip this question</button>
        </div>
      </div>
    </div>
  </section>
</template>
