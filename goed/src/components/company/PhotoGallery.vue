// PhotoGallery — fetches Google Places photos via the company-photos edge function and lets the founder curate the order. Consumers: CompanyEditView.vue.
<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const props = defineProps({
  company: { type: Object, required: true }
})

const isLoading = ref(false)
const error = ref(null)
const photos = ref([])
const isSaving = ref(false)
const saveSuccess = ref(false)

onMounted(async () => {
  // Initialize from existing curated list stored in map_startups.photos
  photos.value = Array.isArray(props.company.photos) ? [...props.company.photos] : []

  if (props.company.google_place_id) {
    isLoading.value = true
    error.value = null
    try {
      const { data, error: fnError } = await supabase.functions.invoke('company-photos', {
        body: { place_id: props.company.google_place_id }
      })
      if (fnError) {
        error.value = fnError.message
      } else if (data?.photos) {
        // Merge: add any fetched photos not already in the curated list (de-dupe by url)
        const existingUrls = new Set(photos.value.map(p => p.url))
        const newPhotos = data.photos.filter(p => !existingUrls.has(p.url))
        photos.value = [...photos.value, ...newPhotos]
      }
    } catch (err) {
      error.value = err.message
    } finally {
      isLoading.value = false
    }
  }
})

function removePhoto(i) {
  photos.value.splice(i, 1)
  saveSuccess.value = false
}

function moveLeft(i) {
  if (i === 0) return
  const arr = [...photos.value]
  ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
  photos.value = arr
  saveSuccess.value = false
}

function moveRight(i) {
  if (i === photos.value.length - 1) return
  const arr = [...photos.value]
  ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
  photos.value = arr
  saveSuccess.value = false
}

async function savePhotos() {
  isSaving.value = true
  saveSuccess.value = false
  error.value = null
  const { error: dbError } = await supabase
    .from('map_startups')
    .update({ photos: photos.value })
    .eq('id', props.company.id)
  if (dbError) {
    error.value = dbError.message
  } else {
    saveSuccess.value = true
  }
  isSaving.value = false
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900">Photos</h3>

    <!-- Loading state -->
    <div v-if="isLoading" class="text-sm text-gray-500">Loading photos…</div>

    <!-- Error banner -->
    <div
      v-if="error"
      class="text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2"
      style="color: #dc2626;"
    >
      {{ error }}
    </div>

    <!-- Success toast -->
    <div
      v-if="saveSuccess"
      class="text-sm bg-green-50 border border-green-200 rounded-md px-3 py-2"
      style="color: #16a34a;"
    >
      Photos saved.
    </div>

    <!-- Empty state: no google_place_id and no curated photos -->
    <div
      v-if="!isLoading && !props.company.google_place_id && photos.length === 0"
      class="text-sm text-gray-500 italic"
    >
      No photos available. Connect a Google Place ID in your listing to import photos automatically.
    </div>

    <!-- Photo grid -->
    <div
      v-if="photos.length > 0"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
    >
      <div
        v-for="(photo, i) in photos"
        :key="photo.url"
        class="relative rounded-md overflow-hidden bg-gray-100 aspect-square"
      >
        <!-- Photo image -->
        <img
          :src="photo.url"
          :alt="photo.attribution ?? 'Company photo'"
          class="w-full h-full object-cover"
        />

        <!-- Remove button (top-right) -->
        <button
          type="button"
          class="absolute top-1 right-1 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full w-6 h-6 flex items-center justify-center text-gray-700 hover:text-red-600 text-xs font-bold shadow transition-colors"
          title="Remove photo"
          @click="removePhoto(i)"
        >
          &times;
        </button>

        <!-- Reorder controls (bottom) -->
        <div class="absolute bottom-1 left-1 right-1 flex justify-between gap-1">
          <button
            type="button"
            :disabled="i === 0"
            class="flex-1 bg-white bg-opacity-80 hover:bg-opacity-100 disabled:opacity-30 rounded text-xs py-0.5 text-gray-700 font-medium transition-colors"
            title="Move left"
            @click="moveLeft(i)"
          >
            &#8592;
          </button>
          <button
            type="button"
            :disabled="i === photos.length - 1"
            class="flex-1 bg-white bg-opacity-80 hover:bg-opacity-100 disabled:opacity-30 rounded text-xs py-0.5 text-gray-700 font-medium transition-colors"
            title="Move right"
            @click="moveRight(i)"
          >
            &#8594;
          </button>
        </div>
      </div>
    </div>

    <!-- Save button -->
    <div v-if="photos.length > 0 || (props.company.google_place_id && !isLoading)">
      <button
        type="button"
        :disabled="isSaving"
        class="bg-utah-blue hover:bg-utah-blue-dark disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors"
        @click="savePhotos"
      >
        {{ isSaving ? 'Saving…' : 'Save photos' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
</style>
