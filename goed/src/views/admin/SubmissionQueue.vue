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
  <div class="h-full flex flex-col p-6">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div>
          <div class="kicker">— Queue</div>
          <h1 class="display-sm mt-1 text-[var(--fg)]">Submission Queue</h1>
        </div>
        <span class="chip-soft">{{ submissions.length }}</span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex-1 py-12 text-center text-[var(--fg-2)] text-sm">
      Loading submissions…
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoading && submissions.length === 0"
      class="flex-1 py-12 text-center text-[var(--fg-3)] text-sm"
    >
      No pending submissions.
    </div>

    <!-- Table -->
    <div
      v-else
      class="flex-1 min-h-0 overflow-y-auto rounded-xl border"
      style="background: var(--surface); border-color: var(--hair);"
    >
      <table class="min-w-full">
        <thead class="sticky top-0" style="background: var(--surface-2);">
          <tr>
            <th class="px-4 py-3 text-left lbl">Submitted At</th>
            <th class="px-4 py-3 text-left lbl">Name</th>
            <th class="px-4 py-3 text-left lbl">Website</th>
            <th class="px-4 py-3 text-left lbl">Submitter Email</th>
            <th class="px-4 py-3 text-left lbl">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in submissions"
            :key="row.id"
            class="cursor-pointer transition-colors border-t"
            style="border-color: var(--hair);"
            @click="openReview(row)"
            @mouseenter="(e) => e.currentTarget.style.background = 'var(--surface-2)'"
            @mouseleave="(e) => e.currentTarget.style.background = 'transparent'"
          >
            <td class="px-4 py-3 text-sm text-[var(--fg-2)] whitespace-nowrap">
              {{ row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '—' }}
            </td>
            <td class="px-4 py-3 text-sm text-[var(--fg)] font-medium">
              {{ row.extracted_data?.name ?? row.name ?? '—' }}
            </td>
            <td class="px-4 py-3 text-sm">
              <a
                v-if="row.extracted_data?.website ?? row.website"
                :href="row.extracted_data?.website ?? row.website"
                target="_blank"
                rel="noopener noreferrer"
                class="link-storm"
                @click.stop
              >
                {{ row.extracted_data?.website ?? row.website }}
              </a>
              <span v-else class="text-[var(--fg-3)]">—</span>
            </td>
            <td class="px-4 py-3 text-sm text-[var(--fg-2)]">
              {{ row.submitted_by_email ?? '—' }}
            </td>
            <td class="px-4 py-3 text-sm" @click.stop>
              <button
                class="btn btn-primary py-[0.4rem] px-3 text-xs"
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
        <div class="absolute inset-0" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);" @click="closeReview" />
        <!-- Panel: right 50% of screen -->
        <div
          ref="panelRef"
          class="absolute top-0 right-0 h-full w-full sm:w-1/2 z-10 flex flex-col border-l"
          style="background: var(--bg-2); border-color: var(--hair); box-shadow: -30px 0 60px -20px rgba(0,0,0,0.6);"
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
