// CompanyEditView — gated by claimGuard; renders the founder-facing inline edit form, photo gallery, and analytics for a single map_startups row. Consumers: router/index.js (CompanyEdit route).
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useClaimAuth } from '@/composables/useClaimAuth'
import PhotoGallery from '@/components/company/PhotoGallery.vue'
import CompanyAnalytics from '@/components/map/CompanyAnalytics.vue'

const router = useRouter()
const route = useRoute()
const id = route.params.id

const { signOut } = useClaimAuth(id)

const company = ref(null)
const form = reactive({})
const isLoading = ref(false)
const isSaving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)

onMounted(async () => {
  isLoading.value = true
  try {
    const { data, error: dbError } = await supabase
      .from('map_startups')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (dbError) {
      saveError.value = dbError.message
      return
    }
    if (data) {
      company.value = data
      Object.assign(form, data)
      // Coerce investors array to comma-separated string for the text input
      form.investors = Array.isArray(data.investors) ? data.investors.join(', ') : ''
    }
  } finally {
    isLoading.value = false
  }
})

async function geocodeAddress(address, city) {
  const q = [address, city, 'Utah', 'USA'].filter(Boolean).join(', ')
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'goed-hackathon' } }
    )
    if (!res.ok) return null
    const results = await res.json()
    if (!results.length) return null
    const r = results[0]
    const a = r.address ?? {}
    const resolvedCity = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null
    return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), city: resolvedCity }
  } catch {
    return null
  }
}

async function save() {
  isSaving.value = true
  saveError.value = null
  saveSuccess.value = false

  const patch = {
    name: form.name,
    description: form.description,
    sector: form.sector,
    stage: form.stage,
    employee_range: form.employee_range,
    total_raised: form.total_raised,
    website: form.website,
    address: form.address,
    city: form.city,
    investors: typeof form.investors === 'string'
      ? form.investors.split(',').map(s => s.trim()).filter(Boolean)
      : (Array.isArray(form.investors) ? form.investors : []),
  }

  // Geocode if address is present
  if (form.address || form.city) {
    const coords = await geocodeAddress(form.address, form.city)
    if (coords) {
      patch.lat = coords.lat
      patch.lng = coords.lng
      if (!patch.city && coords.city) patch.city = coords.city
    }
  }

  try {
    const { data, error: dbError } = await supabase
      .from('map_startups')
      .update(patch)
      .eq('id', id)
      .select()

    if (dbError) {
      saveError.value = dbError.message
      return
    }

    if (!data || data.length === 0) {
      // RLS denied the update — no rows were affected
      saveError.value = 'You do not have permission to edit this listing.'
      return
    }

    saveSuccess.value = true
    company.value = { ...company.value, ...patch, investors: patch.investors }
  } finally {
    isSaving.value = false
  }
}

async function handleSignOut() {
  await signOut()
  router.push({ name: 'Map' })
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 px-4 space-y-6">

    <!-- Header row: title + sign out -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-gray-900">Edit your listing</h1>
      <button
        type="button"
        class="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 hover:border-gray-400 px-3 py-1.5 rounded-md transition-colors"
        @click="handleSignOut"
      >
        Sign out
      </button>
    </div>

    <!-- Analytics cards -->
    <CompanyAnalytics :startup-id="id" />

    <!-- Loading state -->
    <div v-if="isLoading" class="text-sm text-gray-500">Loading…</div>

    <!-- Edit form -->
    <form
      v-else-if="company"
      class="space-y-4 bg-white p-6 rounded-lg shadow"
      @submit.prevent="save"
    >
      <h2 class="text-lg font-semibold text-gray-800 mb-2">Listing details</h2>

      <!-- name -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          v-model="form.name"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- description -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          v-model="form.description"
          rows="4"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- sector -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Sector</label>
        <select
          v-model="form.sector"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-utah-blue"
        >
          <option value="">— Select sector —</option>
          <option>Fintech</option>
          <option>Healthtech</option>
          <option>Edtech</option>
          <option>SaaS</option>
          <option>Proptech</option>
          <option>Cleantech</option>
          <option>Biotech</option>
          <option>Cybersecurity</option>
          <option>AI/ML</option>
          <option>E-commerce</option>
          <option>Other</option>
        </select>
      </div>

      <!-- stage -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Stage</label>
        <select
          v-model="form.stage"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-utah-blue"
        >
          <option value="">— Select stage —</option>
          <option>Pre-seed</option>
          <option>Seed</option>
          <option>Series A</option>
          <option>Series B</option>
          <option>Series C+</option>
          <option>Growth</option>
          <option>Public</option>
          <option>Acquired</option>
        </select>
      </div>

      <!-- employee_range -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Employee Range</label>
        <select
          v-model="form.employee_range"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-utah-blue"
        >
          <option value="">— Select employee range —</option>
          <option>1-10</option>
          <option>11-50</option>
          <option>51-200</option>
          <option>201-500</option>
          <option>500+</option>
        </select>
      </div>

      <!-- investors -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Investors (comma-separated)</label>
        <input
          v-model="form.investors"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
          placeholder="e.g. Pelion, Kickstart, Y Combinator"
        />
      </div>

      <!-- total_raised -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Total Raised</label>
        <input
          v-model="form.total_raised"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
          placeholder="e.g. $2.5M"
        />
      </div>

      <!-- website -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
        <input
          v-model="form.website"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
          placeholder="https://example.com"
        />
      </div>

      <!-- address -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
        <input
          v-model="form.address"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
          placeholder="123 Main St"
        />
      </div>

      <!-- city -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
        <input
          v-model="form.city"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
          placeholder="Salt Lake City"
        />
      </div>

      <!-- Success banner -->
      <div
        v-if="saveSuccess"
        class="text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2 text-green-700"
      >
        Saved successfully.
      </div>

      <!-- Error banner -->
      <div
        v-if="saveError"
        class="text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 text-red-700"
      >
        {{ saveError }}
      </div>

      <!-- Save button -->
      <div class="pt-2">
        <button
          type="submit"
          :disabled="isSaving"
          class="bg-utah-blue hover:bg-utah-blue-dark disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-md text-sm transition-colors"
        >
          {{ isSaving ? 'Saving...' : 'Save changes' }}
        </button>
      </div>
    </form>

    <!-- Photo gallery (only after company row loaded) -->
    <div v-if="company" class="bg-white p-6 rounded-lg shadow">
      <PhotoGallery :company="company" />
    </div>

  </div>
</template>

<style scoped>
</style>
