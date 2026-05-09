<script setup>
import { reactive, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'

const props = defineProps(['company'])
const emit = defineEmits(['close', 'saved'])

const isSaving = ref(false)
const saveError = ref(null)

const form = reactive({ ...props.company })

watch(() => props.company, (val) => {
  if (val) Object.assign(form, val)
})

async function save() {
  isSaving.value = true
  saveError.value = null

  const { id, created_at, updated_at, last_refreshed_at, ...payload } = form

  if (typeof payload.job_titles === 'string') {
    payload.job_titles = payload.job_titles.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (typeof payload.investors === 'string') {
    payload.investors = payload.investors.split(',').map(s => s.trim()).filter(Boolean)
  }

  const { error } = await supabase
    .from('map_startups')
    .update(payload)
    .eq('id', form.id)

  if (error) {
    saveError.value = error.message
    isSaving.value = false
    return
  }

  isSaving.value = false
  emit('saved')
}
</script>

<template>
  <div class="p-6">
    <h2 class="text-xl font-bold text-gray-900 mb-6">Edit Company</h2>

    <form class="space-y-4" @submit.prevent="save">

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
          rows="3"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- website -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
        <input
          v-model="form.website"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- linkedin -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
        <input
          v-model="form.linkedin"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- address -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          v-model="form.address"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- city -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
        <input
          v-model="form.city"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- region -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Region</label>
        <select
          v-model="form.region"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-utah-blue"
        >
          <option value="">— Select region —</option>
          <option>Salt Lake City</option>
          <option>Utah Valley</option>
          <option>Ogden</option>
          <option>St. George</option>
          <option>Other</option>
        </select>
      </div>

      <!-- lat -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
        <input
          v-model.number="form.lat"
          type="number"
          step="any"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- lng -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
        <input
          v-model.number="form.lng"
          type="number"
          step="any"
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

      <!-- funding_stage -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Funding Stage</label>
        <select
          v-model="form.funding_stage"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-utah-blue"
        >
          <option value="">— Select funding stage —</option>
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

      <!-- business_type -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
        <select
          v-model="form.business_type"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-utah-blue"
        >
          <option value="">— Select business type —</option>
          <option>B2B</option>
          <option>B2C</option>
          <option>B2B2C</option>
          <option>Marketplace</option>
          <option>Platform</option>
          <option>Other</option>
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

      <!-- founded_year -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Founded Year</label>
        <input
          v-model.number="form.founded_year"
          type="number"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- is_hiring -->
      <div class="flex items-center gap-2">
        <input
          id="is_hiring"
          v-model="form.is_hiring"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-utah-blue focus:ring-utah-blue"
        />
        <label for="is_hiring" class="text-sm font-medium text-gray-700">Is Hiring</label>
      </div>

      <!-- job_titles -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Job Titles (comma-separated)</label>
        <input
          :value="Array.isArray(form.job_titles) ? form.job_titles.join(', ') : form.job_titles"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
          @input="form.job_titles = $event.target.value"
        />
      </div>

      <!-- careers_url -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Careers URL</label>
        <input
          v-model="form.careers_url"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- logo_url -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
        <input
          v-model="form.logo_url"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- google_place_id -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Google Place ID</label>
        <input
          v-model="form.google_place_id"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- google_rating -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Google Rating</label>
        <input
          v-model.number="form.google_rating"
          type="number"
          step="0.1"
          min="0"
          max="5"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- phone -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          v-model="form.phone"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- investors -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Investors (comma-separated)</label>
        <input
          :value="Array.isArray(form.investors) ? form.investors.join(', ') : form.investors"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
          @input="form.investors = $event.target.value"
        />
      </div>

      <!-- total_raised -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Total Raised</label>
        <input
          v-model="form.total_raised"
          type="text"
          class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utah-blue"
        />
      </div>

      <!-- verified -->
      <div class="flex items-center gap-2">
        <input
          id="verified"
          v-model="form.verified"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-utah-blue focus:ring-utah-blue"
        />
        <label for="verified" class="text-sm font-medium text-gray-700">Verified</label>
      </div>

      <!-- Save error -->
      <div v-if="saveError" class="text-error-red text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {{ saveError }}
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="submit"
          :disabled="isSaving"
          class="bg-utah-blue hover:bg-utah-blue-dark disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors"
        >
          {{ isSaving ? 'Saving...' : 'Save' }}
        </button>
        <button
          type="button"
          class="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-4 py-2 rounded-md text-sm transition-colors"
          @click="emit('close')"
        >
          Cancel
        </button>
      </div>

    </form>
  </div>
</template>

<style scoped>
</style>
