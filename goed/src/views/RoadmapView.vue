<script setup>
import { ref, onMounted } from 'vue'
import gsap from 'gsap'
import RoadmapCard from '@/components/roadmap/RoadmapCard.vue'

const cardsContainer = ref(null)

const roadmapItems = [
  {
    title: 'Stripe Verified MRR/ARR Leaderboard',
    description: 'Opt-in revenue verification via Stripe Connect powers a public leaderboard that surfaces real Utah revenue traction.',
    status: 'Coming Soon',
    icon: '💵',
  },
  {
    title: 'LinkedIn Integration',
    description: 'Pull founder bios, headcount signals, and team-growth deltas straight from LinkedIn to enrich every company card.',
    status: 'Coming Soon',
    icon: '💼',
  },
  {
    title: 'Deeper Investor Analytics',
    description: 'Co-investment graphs, portfolio overlap, and stage-specific check-size benchmarks for every Utah-active fund.',
    status: 'Planned',
    icon: '📊',
  },
  {
    title: 'Investors as First-Class Map Entities',
    description: 'Funds appear as their own pins on the map, with portfolio companies, thesis, and recent activity at a glance.',
    status: 'Planned',
    icon: '🏦',
  },
  {
    title: 'Global Talent Identification & Recruitment Campaigns',
    description: 'Match Utah startups with vetted international talent and run targeted relocation campaigns through the platform.',
    status: 'Planned',
    icon: '🌐',
  },
  {
    title: 'Founder ↔ Investor Matching & Messaging',
    description: 'Two-sided matching with double-opt-in intros, in-app messaging, and AI-suggested fits based on stage and sector.',
    status: 'Planned',
    icon: '🤝',
  },
  {
    title: 'Mobile App',
    description: 'Native iOS/Android map app for founders and investors on the move — same data, same filters, optimized for touch.',
    status: 'Planned',
    icon: '📱',
  },
  {
    title: 'API Access',
    description: 'A documented public API and webhook firehose so builders, journalists, and ecosystems can integrate Utah data.',
    status: 'Planned',
    icon: '🔌',
  },
  {
    title: 'International Expansion Beyond Utah',
    description: 'Take the same playbook to other innovation hubs — Idaho, Arizona, Wyoming first, then international markets.',
    status: 'Planned',
    icon: '🌎',
  },
]

onMounted(() => {
  if (!cardsContainer.value) return
  const cards = cardsContainer.value.querySelectorAll('[data-roadmap-card]')
  gsap.from(cards, {
    opacity: 0,
    y: 24,
    duration: 0.5,
    stagger: 0.08,
    ease: 'power2.out',
  })
})
</script>

<template>
  <section class="max-w-6xl mx-auto px-6 py-12">
    <header class="mb-10 text-center">
      <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">Where we're going</h1>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
        Utah&amp;Startups is the live map of Utah's startup economy today — and the foundation for a deeper, more connected ecosystem tomorrow. Here's what's next on the roadmap.
      </p>
    </header>

    <div ref="cardsContainer" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="item in roadmapItems" :key="item.title" data-roadmap-card>
        <RoadmapCard
          :title="item.title"
          :description="item.description"
          :status="item.status"
          :icon="item.icon"
        />
      </div>
    </div>
  </section>
</template>

<style scoped></style>
