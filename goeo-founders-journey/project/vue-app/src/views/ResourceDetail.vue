<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getResourceById } from '../api'
const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const detail = ref(null)
onMounted(async () => { detail.value = await getResourceById(props.id) })
</script>

<template>
  <section class="flex-1">
    <div class="px-[var(--pad)] pt-6">
      <button class="btn-text" @click="router.push('/results')">← Back to results</button>
    </div>
    <article v-if="detail" class="px-[var(--pad)] pt-10 pb-24 max-w-[860px] mx-auto detail-shell">
      <div class="flex items-center gap-3 mb-6">
        <span class="accent-bar" style="height:36px; width:3px;"></span>
        <div class="kicker">— Resource / #{{ detail.id }}</div>
      </div>
      <h2 class="display-md max-w-[24ch]">{{ detail.title }}</h2>
      <div class="mt-6 flex flex-wrap gap-2">
        <span v-for="t in detail.topics" :key="t" class="badge-cat">{{ t }}</span>
        <span v-for="c in detail.communities" :key="c" class="badge-cat outline">{{ c }}</span>
      </div>
      <hr class="hr-thin my-10" />
      <p class="text-[17px] leading-[1.85] serif-italic" style="color:var(--ink); max-width:62ch;">{{ detail.description }}</p>
      <div class="mt-12 grid md:grid-cols-2 gap-8">
        <div><div class="kicker mb-3">Industries served</div><ul class="flex flex-wrap gap-2"><li v-for="i in detail.industries" :key="i" class="county-tag">{{ i }}</li></ul></div>
        <div><div class="kicker mb-3">Counties</div><ul class="flex flex-wrap gap-2"><li v-for="l in detail.locations" :key="l" class="county-tag">{{ l }}</li></ul></div>
      </div>
      <hr class="hr-thin my-10" />
      <div class="flex flex-wrap gap-4 items-center">
        <a v-if="detail.link" :href="detail.link" target="_blank" rel="noopener" class="btn btn-accent">Visit website <span class="arrow">↗</span></a>
        <a v-if="detail.email" :href="'mailto:' + detail.email" class="btn btn-ghost">Email {{ detail.email }}</a>
      </div>
    </article>
  </section>
</template>
