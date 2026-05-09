<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { submitProfile, INDUSTRY_OPTIONS } from '../api'

const router = useRouter()
const form = reactive({
  name: '', website: '', founded: '',
  sector: '', employees: '', hiring: '', postings: '',
  description: '', linkedin: '', address: '', photoName: '',
})
const errors = reactive({})
const submitting = ref(false)
const success = ref(false)

function validate() {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.name.trim()) errors.name = 'Required'
  if (!form.sector) errors.sector = 'Required'
  if (!form.description.trim()) errors.description = 'Required'
  else if (form.description.split(/\s+/).length > 150) errors.description = 'Keep it to 150 words'
  return Object.keys(errors).length === 0
}
async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  await submitProfile({ ...form })
  submitting.value = false
  success.value = true
  setTimeout(() => router.push('/'), 1800)
}
function onFile(e) { const f = e.target.files?.[0]; form.photoName = f ? f.name : '' }
</script>

<template>
  <section class="flex-1">
    <div class="px-[var(--pad)] pt-12 pb-24 max-w-[920px] mx-auto">
      <div class="idx">— 05 / Add a startup</div>
      <h2 class="display-md mt-6 max-w-[20ch]">Add your startup to Utah's ecosystem.</h2>
      <p class="lede mt-3">Eleven fields, four short groups. Required marked with <span class="req serif-italic">*</span>.</p>

      <form class="mt-12 flex flex-col gap-6" @submit.prevent="onSubmit()">
        <div class="form-section">
          <div class="kicker mb-6">Group 01 — Basics</div>
          <div class="grid md:grid-cols-2 gap-5">
            <div>
              <label class="field-label">Startup name <span class="req serif-italic">*</span></label>
              <input class="input" v-model="form.name" />
              <div v-if="errors.name" class="field-hint" style="color:var(--rust)">{{ errors.name }}</div>
            </div>
            <div><label class="field-label">Website</label><input class="input" v-model="form.website" placeholder="https://" /></div>
            <div><label class="field-label">Year founded</label><input class="input" type="number" v-model="form.founded" /></div>
          </div>
        </div>

        <div class="form-section">
          <div class="kicker mb-6">Group 02 — Business info</div>
          <div class="grid md:grid-cols-2 gap-5">
            <div>
              <label class="field-label">Sector / Industry <span class="req serif-italic">*</span></label>
              <select class="select" v-model="form.sector">
                <option value="">Select one</option>
                <option v-for="o in INDUSTRY_OPTIONS" :key="o.id" :value="o.match">{{ o.title }}</option>
              </select>
              <div v-if="errors.sector" class="field-hint" style="color:var(--rust)">{{ errors.sector }}</div>
            </div>
            <div><label class="field-label">Employees</label><input class="input" type="number" v-model="form.employees" /></div>
            <div>
              <label class="field-label">Hiring</label>
              <div class="flex gap-3">
                <label v-for="opt in ['Yes','No','Maybe']" :key="opt" class="chip cursor-pointer" :class="{ 'is-active': form.hiring === opt }">
                  <input type="radio" v-model="form.hiring" :value="opt" class="hidden" />{{ opt }}
                </label>
              </div>
            </div>
            <div><label class="field-label">Job postings</label><textarea class="textarea" v-model="form.postings" style="min-height:96px;"></textarea></div>
          </div>
        </div>

        <div class="form-section">
          <div class="kicker mb-6">Group 03 — Marketing</div>
          <div>
            <label class="field-label">Description <span class="req serif-italic">*</span> <span class="foot-mark ml-2">150 words max</span></label>
            <textarea class="textarea" v-model="form.description"></textarea>
            <div v-if="errors.description" class="field-hint" style="color:var(--rust)">{{ errors.description }}</div>
          </div>
          <div class="grid md:grid-cols-2 gap-5 mt-5">
            <div><label class="field-label">LinkedIn</label><input class="input" v-model="form.linkedin" /></div>
            <div><label class="field-label">Address</label><input class="input" v-model="form.address" /></div>
          </div>
        </div>

        <div class="form-section">
          <div class="kicker mb-6">Group 04 — Media</div>
          <label class="field-label">Photo or logo</label>
          <label class="opt cursor-pointer text-center" style="border-style:dashed;">
            <span class="opt-num">Drag &amp; drop</span>
            <span class="opt-title" style="font-size:1.25rem;">{{ form.photoName || 'Choose a file' }}</span>
            <input type="file" accept="image/*" class="hidden" @change="onFile" />
          </label>
        </div>

        <div class="flex items-center justify-end gap-4 pt-4">
          <button type="button" class="btn-text" @click="router.push('/')">Cancel</button>
          <button type="submit" class="btn btn-accent" :disabled="submitting">
            <span v-if="!submitting">Add my startup <span class="arrow">→</span></span>
            <span v-else>Submitting…</span>
          </button>
        </div>
      </form>

      <transition name="fade">
        <div v-if="success" class="toast"><span class="dot" style="background:var(--accent)"></span> Thanks — your startup has been added.</div>
      </transition>
    </div>
  </section>
</template>
