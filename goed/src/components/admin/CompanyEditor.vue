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

  const { id, created_at, updated_at, last_refreshed_at, deleted_at, ...payload } = form

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
    <div class="kicker">— Edit</div>
    <h2 class="display-sm mt-1 mb-6 text-[var(--fg)]">Edit Company</h2>

    <form class="space-y-4" @submit.prevent="save">

      <!-- name -->
      <div>
        <label class="field-label">Name</label>
        <input
          v-model="form.name"
          type="text"
          class="input"
        />
      </div>

      <!-- description -->
      <div>
        <label class="field-label">Description</label>
        <textarea
          v-model="form.description"
          rows="3"
          class="input"
        />
      </div>

      <!-- website -->
      <div>
        <label class="field-label">Website</label>
        <input
          v-model="form.website"
          type="text"
          class="input"
        />
      </div>

      <!-- linkedin -->
      <div>
        <label class="field-label">LinkedIn</label>
        <input
          v-model="form.linkedin"
          type="text"
          class="input"
        />
      </div>

      <!-- address -->
      <div>
        <label class="field-label">Address</label>
        <input
          v-model="form.address"
          type="text"
          class="input"
        />
      </div>

      <!-- city -->
      <div>
        <label class="field-label">City</label>
        <input
          v-model="form.city"
          type="text"
          class="input"
        />
      </div>

      <!-- region -->
      <div>
        <label class="field-label">Region</label>
        <select
          v-model="form.region"
          class="select"
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
        <label class="field-label">Latitude</label>
        <input
          v-model.number="form.lat"
          type="number"
          step="any"
          class="input"
        />
      </div>

      <!-- lng -->
      <div>
        <label class="field-label">Longitude</label>
        <input
          v-model.number="form.lng"
          type="number"
          step="any"
          class="input"
        />
      </div>

      <!-- sector -->
      <div>
        <label class="field-label">Sector</label>
        <select
          v-model="form.sector"
          class="select"
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
        <label class="field-label">Stage</label>
        <select
          v-model="form.stage"
          class="select"
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
        <label class="field-label">Funding Stage</label>
        <select
          v-model="form.funding_stage"
          class="select"
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
        <label class="field-label">Business Type</label>
        <select
          v-model="form.business_type"
          class="select"
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
        <label class="field-label">Employee Range</label>
        <select
          v-model="form.employee_range"
          class="select"
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
        <label class="field-label">Founded Year</label>
        <input
          v-model.number="form.founded_year"
          type="number"
          class="input"
        />
      </div>

      <!-- is_hiring -->
      <div class="flex items-center gap-2">
        <input
          id="is_hiring"
          v-model="form.is_hiring"
          type="checkbox"
          class="h-4 w-4 rounded accent-[var(--accent)]"
        />
        <label for="is_hiring" class="text-sm font-medium text-[var(--fg)]">Is Hiring</label>
      </div>

      <!-- job_titles -->
      <div>
        <label class="field-label">Job Titles (comma-separated)</label>
        <input
          :value="Array.isArray(form.job_titles) ? form.job_titles.join(', ') : form.job_titles"
          type="text"
          class="input"
          @input="form.job_titles = $event.target.value"
        />
      </div>

      <!-- careers_url -->
      <div>
        <label class="field-label">Careers URL</label>
        <input
          v-model="form.careers_url"
          type="text"
          class="input"
        />
      </div>

      <!-- logo_url -->
      <div>
        <label class="field-label">Logo URL</label>
        <input
          v-model="form.logo_url"
          type="text"
          class="input"
        />
      </div>

      <!-- google_place_id -->
      <div>
        <label class="field-label">Google Place ID</label>
        <input
          v-model="form.google_place_id"
          type="text"
          class="input"
        />
      </div>

      <!-- google_rating -->
      <div>
        <label class="field-label">Google Rating</label>
        <input
          v-model.number="form.google_rating"
          type="number"
          step="0.1"
          min="0"
          max="5"
          class="input"
        />
      </div>

      <!-- phone -->
      <div>
        <label class="field-label">Phone</label>
        <input
          v-model="form.phone"
          type="text"
          class="input"
        />
      </div>

      <!-- investors -->
      <div>
        <label class="field-label">Investors (comma-separated)</label>
        <input
          :value="Array.isArray(form.investors) ? form.investors.join(', ') : form.investors"
          type="text"
          class="input"
          @input="form.investors = $event.target.value"
        />
      </div>

      <!-- total_raised -->
      <div>
        <label class="field-label">Total Raised</label>
        <input
          v-model="form.total_raised"
          type="text"
          class="input"
        />
      </div>

      <!-- verified -->
      <div class="flex items-center gap-2">
        <input
          id="verified"
          v-model="form.verified"
          type="checkbox"
          class="h-4 w-4 rounded accent-[var(--accent)]"
        />
        <label for="verified" class="text-sm font-medium text-[var(--fg)]">Verified</label>
      </div>

      <!-- is_hidden -->
      <div class="flex items-center gap-2">
        <input
          id="is_hidden"
          v-model="form.is_hidden"
          type="checkbox"
          class="h-4 w-4 rounded accent-[var(--accent)]"
        />
        <label for="is_hidden" class="text-sm font-medium text-[var(--fg)]">Hidden from public map</label>
      </div>

      <!-- Save error -->
      <div
        v-if="saveError"
        class="rounded-md px-3 py-2 text-sm"
        style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35); color: var(--warn);"
      >
        {{ saveError }}
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="submit"
          :disabled="isSaving"
          class="btn btn-primary"
          :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
        >
          {{ isSaving ? 'Saving...' : 'Save' }}
        </button>
        <button
          type="button"
          class="btn btn-ghost"
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
