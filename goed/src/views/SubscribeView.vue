<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'

const SECTOR_OPTIONS = ['AI', 'SaaS', 'HealthTech', 'FinTech', 'EdTech', 'CleanTech', 'BioTech', 'Hardware', 'Consumer', 'Other']
const STAGE_OPTIONS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Growth']
const REGION_OPTIONS = ['Salt Lake City', 'Provo / Utah Valley', 'Ogden', 'Park City', 'St. George', 'Logan', 'Other']

const route = useRoute()
const email = ref('')
const sectors = ref([])
const stages = ref([])
const regions = ref([])
const hiringOnly = ref(false)
const investor = ref('')
const isSubmitting = ref(false)
const submitted = ref(false)
const alreadySubscribed = ref(false)
const error = ref(null)
const banner = ref(null) // 'confirmed' | 'already' | 'invalid' | 'unsubscribed' | null

onMounted(async () => {
  if (route.query.confirmed === 'true') {
    banner.value = 'confirmed'
  } else if (route.query.confirmed === 'already') {
    banner.value = 'already'
  } else if (route.query.error === 'invalid') {
    banner.value = 'invalid'
  } else if (route.query.unsubscribe) {
    await supabase.from('map_subscriptions').delete().eq('id', route.query.unsubscribe)
    banner.value = 'unsubscribed'
  }
})

async function handleSubmit() {
  isSubmitting.value = true
  error.value = null
  alreadySubscribed.value = false

  const filter_criteria = {
    sectors: sectors.value,
    stages: stages.value,
    regions: regions.value,
    hiring_only: hiringOnly.value,
    investor: investor.value.trim()
  }

  const { error: dbError } = await supabase
    .from('map_subscriptions')
    .insert({ email: email.value, filter_criteria })

  if (dbError?.code === '23505') {
    alreadySubscribed.value = true
    isSubmitting.value = false
    return
  }

  if (dbError) {
    error.value = dbError.message
    isSubmitting.value = false
    return
  }

  const { error: invokeError } = await supabase.functions.invoke('send-confirmation', {
    body: { email: email.value }
  })

  if (invokeError) {
    error.value = invokeError.message
  }

  submitted.value = true
  sectors.value = []
  stages.value = []
  regions.value = []
  hiringOnly.value = false
  investor.value = ''
  isSubmitting.value = false
}
</script>

<template>
  <div class="min-h-screen py-12 px-4" style="background: var(--bg); color: var(--fg)">
    <div class="max-w-2xl mx-auto">

      <!-- Page heading -->
      <div class="mb-8">
        <span class="kicker">— Startup Map</span>
        <h1 class="display-sm mt-2" style="color: var(--fg)">
          Subscribe to Utah Startup Map updates
        </h1>
        <p class="lede mt-3">
          Get a digest of newly added startups filtered to your interests. Confirm your email after subscribing.
        </p>
      </div>

      <!-- Banner block -->
      <div v-if="banner" class="mb-6">
        <!-- confirmed -->
        <div
          v-if="banner === 'confirmed'"
          class="flex items-start gap-3 rounded-xl px-5 py-4"
          style="background: rgba(17,223,129,0.08); border: 1px solid rgba(17,223,129,0.35); color: var(--accent)"
        >
          <svg class="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium">You're confirmed! Watch for our next digest.</span>
        </div>

        <!-- already confirmed -->
        <div
          v-else-if="banner === 'already'"
          class="flex items-start gap-3 rounded-xl px-5 py-4"
          style="background: rgba(95,179,255,0.08); border: 1px solid rgba(95,179,255,0.35); color: var(--info)"
        >
          <svg class="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium">This subscription is already confirmed.</span>
        </div>

        <!-- invalid link -->
        <div
          v-else-if="banner === 'invalid'"
          class="flex items-start gap-3 rounded-xl px-5 py-4"
          style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.35); color: #f87171"
        >
          <svg class="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="text-sm font-medium">That confirmation link is invalid or expired.</span>
        </div>

        <!-- unsubscribed -->
        <div
          v-else-if="banner === 'unsubscribed'"
          class="flex items-start gap-3 rounded-xl px-5 py-4"
          style="background: var(--surface); border: 1px solid var(--hair); color: var(--fg-2)"
        >
          <svg class="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span class="text-sm font-medium">You've been unsubscribed.</span>
        </div>
      </div>

      <!-- Success panel -->
      <div
        v-if="submitted"
        class="form-section flex flex-col items-center text-center gap-4 py-10"
      >
        <div class="w-12 h-12 rounded-full flex items-center justify-center" style="background: rgba(17,223,129,0.12)">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: var(--accent)">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 class="display-sm" style="color: var(--fg)">Check your inbox</h2>
        <p class="lede" style="max-width: 40ch">
          We sent a confirmation link to <strong style="color: var(--fg)">{{ email }}</strong>. Click it to activate your subscription.
        </p>
      </div>

      <!-- Already subscribed panel -->
      <div
        v-else-if="alreadySubscribed"
        class="form-section flex flex-col items-center text-center gap-3 py-8"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color: var(--info)">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p style="color: var(--fg-2)" class="text-sm">
          You're already subscribed with that email. Check your inbox for the confirmation link, or contact support if you need help.
        </p>
      </div>

      <!-- Subscribe form -->
      <form v-else class="form-section flex flex-col gap-6" @submit.prevent="handleSubmit">

        <!-- Email -->
        <div class="flex flex-col gap-1">
          <label for="email" class="field-label">
            Email address <span class="req">*</span>
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="input"
            placeholder="you@example.com"
          />
        </div>

        <!-- Sectors -->
        <div class="flex flex-col gap-2">
          <span class="field-label">Sectors (optional)</span>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="opt in SECTOR_OPTIONS"
              :key="opt"
              class="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                :value="opt"
                v-model="sectors"
                class="accent-checkbox"
                style="accent-color: var(--accent)"
              />
              <span class="text-sm" style="color: var(--fg-2)">{{ opt }}</span>
            </label>
          </div>
        </div>

        <!-- Stages -->
        <div class="flex flex-col gap-2">
          <span class="field-label">Funding stages (optional)</span>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="opt in STAGE_OPTIONS"
              :key="opt"
              class="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                :value="opt"
                v-model="stages"
                style="accent-color: var(--accent)"
              />
              <span class="text-sm" style="color: var(--fg-2)">{{ opt }}</span>
            </label>
          </div>
        </div>

        <!-- Regions -->
        <div class="flex flex-col gap-2">
          <span class="field-label">Regions (optional)</span>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="opt in REGION_OPTIONS"
              :key="opt"
              class="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                :value="opt"
                v-model="regions"
                style="accent-color: var(--accent)"
              />
              <span class="text-sm" style="color: var(--fg-2)">{{ opt }}</span>
            </label>
          </div>
        </div>

        <!-- Hiring only toggle -->
        <div class="flex items-center gap-3">
          <input
            id="hiringOnly"
            type="checkbox"
            v-model="hiringOnly"
            style="accent-color: var(--accent)"
            class="w-4 h-4"
          />
          <label for="hiringOnly" class="field-label mb-0 cursor-pointer" style="margin-bottom: 0">
            Hiring companies only
          </label>
        </div>

        <!-- Investor filter -->
        <div class="flex flex-col gap-1">
          <label for="investor" class="field-label">Investor / fund filter (optional)</label>
          <input
            id="investor"
            v-model="investor"
            type="text"
            class="input"
            placeholder="Investor / fund name (optional)"
          />
          <span class="field-hint">Only show startups backed by this investor or fund.</span>
        </div>

        <!-- Error message -->
        <p v-if="error" class="text-sm" style="color: #f87171">
          {{ error }}
        </p>

        <!-- Submit button -->
        <div class="flex justify-end">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="isSubmitting"
            :style="isSubmitting ? 'opacity: 0.6; cursor: not-allowed' : ''"
          >
            <svg v-if="isSubmitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {{ isSubmitting ? 'Subscribing…' : 'Subscribe' }}
          </button>
        </div>

      </form>

    </div>
  </div>
</template>

<style scoped>
</style>
