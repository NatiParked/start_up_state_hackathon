<script setup>
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

const props = defineProps({
  submission: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['approved', 'rejected', 'close'])

const isSaving = ref(false)
const inlineError = ref(null)

// Reject state
const showRejectForm = ref(false)
const rejectionReason = ref('')

// Edit-then-Approve state
const showEditForm = ref(false)
const editedData = ref({})

const websiteUrl = computed(
  () => props.submission.extracted_data?.website ?? props.submission.website ?? '',
)

const displayData = computed(() => {
  if (props.submission.extracted_data && Object.keys(props.submission.extracted_data).length > 0) {
    return Object.entries(props.submission.extracted_data)
  }
  // Fall back to flat columns
  const flat = {}
  const cols = ['name', 'description', 'website', 'sector', 'stage', 'linkedin', 'address', 'city']
  for (const col of cols) {
    if (props.submission[col] != null) flat[col] = props.submission[col]
  }
  return Object.entries(flat)
})

function initEditForm() {
  if (props.submission.extracted_data && Object.keys(props.submission.extracted_data).length > 0) {
    editedData.value = { ...props.submission.extracted_data }
  } else {
    const flat = {}
    const cols = ['name', 'description', 'website', 'sector', 'stage', 'linkedin', 'address', 'city']
    for (const col of cols) {
      if (props.submission[col] != null) flat[col] = props.submission[col]
    }
    editedData.value = { ...flat }
  }
}

function toggleRejectForm() {
  showRejectForm.value = !showRejectForm.value
  showEditForm.value = false
  inlineError.value = null
}

function toggleEditForm() {
  showEditForm.value = !showEditForm.value
  showRejectForm.value = false
  inlineError.value = null
  if (showEditForm.value) initEditForm()
}

async function handleApprove() {
  isSaving.value = true
  inlineError.value = null
  try {
    const { data, error } = await supabase.functions.invoke('approve-submission', {
      body: { submission_id: props.submission.id },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    emit('approved', props.submission.id)
  } catch (err) {
    inlineError.value = err.message ?? 'Approval failed'
  } finally {
    isSaving.value = false
  }
}

async function handleReject() {
  if (!rejectionReason.value.trim()) {
    inlineError.value = 'Please enter a rejection reason'
    return
  }
  isSaving.value = true
  inlineError.value = null
  try {
    const { data, error } = await supabase.functions.invoke('reject-submission', {
      body: {
        submission_id: props.submission.id,
        rejection_reason: rejectionReason.value.trim(),
      },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    emit('rejected', props.submission.id)
  } catch (err) {
    inlineError.value = err.message ?? 'Rejection failed'
  } finally {
    isSaving.value = false
  }
}

async function handleEditApprove() {
  isSaving.value = true
  inlineError.value = null
  try {
    const { data, error } = await supabase.functions.invoke('approve-submission', {
      body: {
        submission_id: props.submission.id,
        overrides: editedData.value,
      },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    emit('approved', props.submission.id)
  } catch (err) {
    inlineError.value = err.message ?? 'Approval with edits failed'
  } finally {
    isSaving.value = false
  }
}

function isScalar(val) {
  return typeof val !== 'object' || val === null
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden" style="background: var(--bg-2);">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style="border-color: var(--hair);">
      <div>
        <div class="kicker">— Review</div>
        <h2 class="display-sm mt-1 text-[var(--fg)]">Review Submission</h2>
      </div>
      <button
        class="text-2xl leading-none text-[var(--fg-2)] hover:text-[var(--fg)]"
        @click="emit('close')"
      >
        &times;
      </button>
    </div>

    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        <!-- Left: extracted data fields -->
        <div>
          <h3 class="kicker mb-3">Submission Data</h3>
          <div v-if="displayData.length > 0" class="space-y-3">
            <div
              v-for="[key, val] in displayData"
              :key="key"
              class="text-sm"
            >
              <span class="block font-medium text-[var(--fg-2)] capitalize">{{ key.replace(/_/g, ' ') }}</span>
              <span class="block text-[var(--fg)] break-words">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
            </div>
          </div>
          <p v-else class="text-sm text-[var(--fg-3)]">No data available.</p>

          <!-- Submission meta -->
          <div class="mt-6 space-y-2 text-sm border-t pt-4" style="border-color: var(--hair);">
            <div>
              <span class="font-medium text-[var(--fg-2)]">Submitted URL: </span>
              <a
                v-if="submission.submitted_url"
                :href="submission.submitted_url"
                target="_blank"
                rel="noopener noreferrer"
                class="link-storm break-all"
              >{{ submission.submitted_url }}</a>
              <span v-else class="text-[var(--fg)]">—</span>
            </div>
            <div>
              <span class="font-medium text-[var(--fg-2)]">Submitted by: </span>
              <span class="text-[var(--fg)]">{{ submission.submitted_by_email ?? '—' }}</span>
            </div>
            <div>
              <span class="font-medium text-[var(--fg-2)]">Submitted at: </span>
              <span class="text-[var(--fg)]">{{ submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—' }}</span>
            </div>
          </div>
        </div>

        <!-- Right: website preview -->
        <div>
          <h3 class="kicker mb-3">Website Preview</h3>
          <div v-if="websiteUrl">
            <iframe
              :src="websiteUrl"
              class="w-full h-64 rounded-md border"
              style="background: var(--surface); border-color: var(--hair);"
              referrerpolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin"
            />
            <a
              :href="websiteUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="link-storm mt-2 block text-sm"
            >Open in new tab</a>
          </div>
          <p v-else class="text-sm text-[var(--fg-3)]">No website URL available.</p>
        </div>
      </div>

      <!-- Reject form -->
      <div
        v-if="showRejectForm"
        class="mx-6 mb-4 p-4 rounded-md"
        style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35);"
      >
        <label class="field-label">Rejection reason</label>
        <textarea
          v-model="rejectionReason"
          rows="3"
          class="textarea"
          placeholder="Explain why this submission is being rejected..."
        />
        <div class="flex gap-2 mt-2">
          <button
            :disabled="isSaving"
            class="btn"
            style="background: var(--warn); color: #07140A;"
            :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
            @click="handleReject"
          >
            {{ isSaving ? 'Rejecting…' : 'Confirm Reject' }}
          </button>
          <button
            :disabled="isSaving"
            class="btn btn-ghost"
            :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
            @click="toggleRejectForm"
          >
            Cancel
          </button>
        </div>
      </div>

      <!-- Edit-then-Approve form -->
      <div
        v-if="showEditForm"
        class="mx-6 mb-4 p-4 rounded-md"
        style="background: var(--surface); border: 1px solid var(--hair);"
      >
        <h4 class="kicker mb-3">Edit fields before approving</h4>
        <div class="space-y-3">
          <div
            v-for="(val, key) in editedData"
            :key="key"
          >
            <template v-if="isScalar(val)">
              <label class="field-label capitalize">
                {{ String(key).replace(/_/g, ' ') }}
              </label>
              <input
                v-model="editedData[key]"
                type="text"
                class="input"
              />
            </template>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button
            :disabled="isSaving"
            class="btn btn-primary"
            :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
            @click="handleEditApprove"
          >
            {{ isSaving ? 'Saving…' : 'Save & Approve' }}
          </button>
          <button
            :disabled="isSaving"
            class="btn btn-ghost"
            :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
            @click="toggleEditForm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Inline error -->
    <div
      v-if="inlineError"
      class="mx-6 mb-2 p-3 rounded-md text-sm flex-shrink-0"
      style="background: rgba(244,162,97,0.08); border: 1px solid rgba(244,162,97,0.35); color: var(--warn);"
    >
      {{ inlineError }}
    </div>

    <!-- Action buttons footer -->
    <div class="flex items-center gap-3 px-6 py-4 border-t flex-shrink-0" style="border-color: var(--hair);">
      <button
        :disabled="isSaving"
        class="btn btn-primary"
        :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
        @click="handleApprove"
      >
        {{ isSaving ? 'Saving…' : 'Approve' }}
      </button>
      <button
        :disabled="isSaving"
        class="btn"
        style="background: var(--warn); color: #07140A;"
        :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
        @click="toggleRejectForm"
      >
        Reject
      </button>
      <button
        :disabled="isSaving"
        class="btn btn-ghost"
        :class="{ 'opacity-60 cursor-not-allowed': isSaving }"
        @click="toggleEditForm"
      >
        Edit &amp; Approve
      </button>
    </div>
  </div>
</template>

<style scoped>
</style>
