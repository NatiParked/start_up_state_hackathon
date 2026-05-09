// CompanyAnalytics — two stat cards backed by the get_company_view_stats RPC. Consumers: CompanyEditView.vue.
<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

const props = defineProps({
  startupId: { type: String, required: true }
})

const isLoading = ref(false)
const error = ref(null)
const stats = ref({ views_this_week: 0, views_total: 0 })

onMounted(async () => {
  isLoading.value = true
  try {
    const { data, error: rpcError } = await supabase.rpc('get_company_view_stats', {
      p_startup_id: props.startupId
    })
    if (rpcError) {
      error.value = rpcError
    } else if (data) {
      stats.value = data
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div>
    <div class="flex gap-4">
      <!-- Views this week card -->
      <div class="flex-1 bg-utah-blue text-white rounded-lg p-4 text-center">
        <p class="text-3xl font-bold">{{ stats.views_this_week }}</p>
        <p class="text-sm mt-1 opacity-90">Views this week</p>
      </div>
      <!-- Views total card -->
      <div class="flex-1 bg-utah-blue text-white rounded-lg p-4 text-center">
        <p class="text-3xl font-bold">{{ stats.views_total }}</p>
        <p class="text-sm mt-1 opacity-90">Views total</p>
      </div>
    </div>
    <p class="text-xs text-gray-500 mt-2">Live stats coming soon</p>
  </div>
</template>

<style scoped>
</style>
