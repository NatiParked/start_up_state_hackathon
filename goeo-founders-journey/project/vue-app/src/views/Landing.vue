<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'

const router = useRouter()
const heroWords = "Find what Utah\u2019s ecosystem already built for you.".split(' ')

onMounted(() => {
  const tl = gsap.timeline()
  tl.to('[data-anim="kicker"]', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
    .to('[data-anim="word"]', { y: '0%', duration: 0.85, ease: 'power3.out', stagger: 0.06 }, '-=0.2')
    .to('[data-anim="lede"]', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.4')
    .to('[data-anim="cta"]',  { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, '-=0.3')
    .to('[data-anim="meta"]', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
})
</script>

<template>
  <section class="flex-1">
    <div class="layout-edge">
      <div class="px-[var(--pad)] pt-[clamp(2.5rem,6vw,6rem)] pb-12 flex flex-col">
        <div class="idx fade-up" data-anim="kicker">— 01 / Founders</div>
        <h1 class="display mt-8">
          <template v-for="(w, i) in heroWords" :key="i">
            <span class="word-mask"><span data-anim="word">{{ w }}<template v-if="i < heroWords.length - 1">&nbsp;</template></span></span>
          </template>
        </h1>
        <p class="lede mt-10 fade-up" data-anim="lede">
          Three short questions. A ranked list of the funding, mentorship, talent, and
          community resources Utah has waiting for you. Built for founders at any stage.
        </p>
        <div class="flex flex-wrap items-center gap-4 mt-12">
          <button class="btn btn-primary fade-up" data-anim="cta" @click="router.push('/quiz')">
            Begin guided quiz <span class="arrow">→</span>
          </button>
          <button class="btn btn-ghost fade-up" data-anim="cta" @click="router.push('/results')">
            Browse all resources
          </button>
        </div>
        <div class="mt-auto pt-16">
          <hr class="hr-thin" />
          <div class="grid grid-cols-3 gap-6 pt-6 fade-up" data-anim="meta">
            <div><div class="kicker">Resources</div><div class="display-sm mt-2">213</div></div>
            <div><div class="kicker">Counties</div><div class="display-sm mt-2">29</div></div>
            <div><div class="kicker">Avg. time</div><div class="display-sm mt-2">~2 min</div></div>
          </div>
        </div>
      </div>
      <aside class="hidden md:flex flex-col border-l border-[var(--hair)]" style="background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0));">
        <div class="px-[var(--pad)] pt-[clamp(2.5rem,6vw,6rem)] pb-10 fade-up" data-anim="meta">
          <div class="kicker">— 02 / How it works</div>
          <ol class="mt-8">
            <li class="py-5 border-b border-[var(--hair)]" v-for="(s, i) in [
              { t: 'Tell us your stage', d: 'Pre-revenue, early, scaling, or established.' },
              { t: 'Pick an industry', d: 'Software, healthcare, manufacturing, agriculture, hospitality.' },
              { t: 'Name what you need', d: 'Funding, talent, community, legal, or marketing.' },
              { t: 'Get your matches', d: 'Ranked, filterable, sourced from across the state.' },
            ]" :key="i">
              <div class="flex items-baseline gap-5">
                <span class="foot-mark">0{{ i + 1 }}</span>
                <div>
                  <div class="display-sm">{{ s.t }}</div>
                  <div class="lede mt-1" style="font-size:14px">{{ s.d }}</div>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </aside>
    </div>
  </section>
</template>
