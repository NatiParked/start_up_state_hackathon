<script setup>
import { ref, watch, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { storeToRefs } from 'pinia'
import gsap from 'gsap'
import SubmissionReview from '@/components/admin/SubmissionReview.vue'

const store = useAdminStore()
const { submissions, isLoading } = storeToRefs(store)
const selectedSubmission = ref(null)
const panelRef = ref(null)

onMounted(() => store.fetchSubmissions())

watch(selectedSubmission, (val) => {
  if (val && panelRef.value) {
    gsap.from(panelRef.value, { x: '100%', duration: 0.3, ease: 'power2.out' })
  }
})

function openReview(submission) {
  selectedSubmission.value = submission
}

function closeReview() {
  selectedSubmission.value = null
}

function onApproved(submissionId) {
  store.submissions = store.submissions.filter((s) => s.id !== submissionId)
  closeReview()
}

function onRejected(submissionId) {
  store.submissions = store.submissions.filter((s) => s.id !== submissionId)
  closeReview()
}
</script>

<template>
  <div class="relative">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold text-gray-900">Submission Queue</h1>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {{ submissions.length }}
        </span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="py-12 text-center text-gray-500 text-sm">
      Loading submissions…
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoading && submissions.length === 0"
      class="py-12 text-center text-gray-400 text-sm"
    >
      No pending submissions.
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Submitted At
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Name
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Website
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Submitter Email
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              Action
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          <tr
            v-for="row in submissions"
            :key="row.id"
            class="hover:bg-gray-50 cursor-pointer transition-colors"
            @click="openReview(row)"
          >
            <td class="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
              {{ row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900 font-medium">
              {{ row.extracted_data?.name ?? row.name ?? '—' }}
            </td>
            <td class="px-4 py-3 text-sm">
              <a
                v-if="row.extracted_data?.website ?? row.website"
                :href="row.extracted_data?.website ?? row.website"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 underline hover:text-blue-800 transition-colors"
                @click.stop
              >
                {{ row.extracted_data?.website ?? row.website }}
              </a>
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700">
              {{ row.submitted_by_email ?? '—' }}
            </td>
            <td class="px-4 py-3 text-sm" @click.stop>
              <button
                class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                @click="openReview(row)"
              >
                Review
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Slide-in review panel (teleported to body) -->
    <Teleport to="body">
      <div
        v-if="selectedSubmission"
        class="fixed inset-0 z-50"
        @click.self="closeReview"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/30" @click="closeReview" />
        <!-- Panel: right 50% of screen -->
        <div
          ref="panelRef"
          class="absolute top-0 right-0 h-full w-full sm:w-1/2 bg-white shadow-2xl z-10 flex flex-col"
        >
          <SubmissionReview
            :submission="selectedSubmission"
            @approved="onApproved"
            @rejected="onRejected"
            @close="closeReview"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
