<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getResourceById, RESOURCE_TYPE_LABELS, REGION_LABELS } from '../api'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const detail = ref(null)

onMounted(async () => { detail.value = await getResourceById(props.id) })

function typeLabel(slug) { return RESOURCE_TYPE_LABELS[slug] ?? slug }
function regionLabel(slug) { return REGION_LABELS[slug] ?? slug }
</script>

<template>
  <section class="flex-1">
    <div class="px-[var(--pad)] pt-6">
      <button class="btn-text" @click="router.push('/results')">← Back to results</button>
    </div>
    <article v-if="detail" class="px-[var(--pad)] pt-10 pb-24 max-w-[860px] mx-auto detail-shell">
      <div class="flex items-center gap-3 mb-6">
        <span class="accent-bar" style="height:36px; width:3px;"></span>
        <div class="kicker">— Resource / {{ detail.id }}</div>
      </div>
      <h2 class="display-md max-w-[24ch]">{{ detail.name }}</h2>
      <div class="mt-6 flex flex-wrap gap-2">
        <span v-for="t in detail.tags.resource_type" :key="t" class="badge-cat">{{ typeLabel(t) }}</span>
      </div>
      <hr class="hr-thin my-10" />
      <p class="text-[17px] leading-[1.85] serif-italic" style="color:var(--ink); max-width:62ch;">{{ detail.summary }}</p>
      <div v-if="detail.eligibility" class="mt-6 text-[15px]" style="color:var(--text-2);">
        <span class="kicker" style="display:inline;">Eligibility: </span>{{ detail.eligibility }}
      </div>
      <div class="mt-12 grid md:grid-cols-2 gap-8">
        <div>
          <div class="kicker mb-3">Industries served</div>
          <ul class="flex flex-wrap gap-2">
            <li v-for="ind in detail.tags.industry" :key="ind" class="county-tag">{{ ind }}</li>
          </ul>
        </div>
        <div>
          <div class="kicker mb-3">Region</div>
          <ul class="flex flex-wrap gap-2">
            <li v-for="reg in detail.tags.region" :key="reg" class="county-tag">{{ regionLabel(reg) }}</li>
          </ul>
        </div>
      </div>
      <hr class="hr-thin my-10" />
      <div class="flex flex-wrap gap-4 items-center">
        <a v-if="detail.url" :href="detail.url" target="_blank" rel="noopener" class="btn btn-accent">Visit website <span class="arrow">↗</span></a>
        <a v-if="detail.email" :href="'mailto:' + detail.email" class="btn btn-ghost">Email {{ detail.email }}</a>
      </div>
    </article>
  </section>
</template>
