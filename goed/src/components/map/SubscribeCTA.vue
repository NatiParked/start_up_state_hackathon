<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const dismissed = ref(false)
const visible = ref(false)
const STORAGE_KEY = 'subscribe_cta_dismissed'
let revealTimer = null

function handleDismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch (_e) {
    // localStorage may be disabled (private mode); fall through and just hide for the session
  }
  dismissed.value = true
}

function handleSubscribeClick() {
  router.push({ name: 'Subscribe' })
}

onMounted(() => {
  let alreadyDismissed = false
  try {
    alreadyDismissed = localStorage.getItem(STORAGE_KEY) === '1'
  } catch (_e) {
    alreadyDismissed = false
  }
  if (alreadyDismissed) {
    dismissed.value = true
    return
  }
  revealTimer = window.setTimeout(() => {
    visible.value = true
  }, 3000)
})

onBeforeUnmount(() => {
  if (revealTimer) {
    window.clearTimeout(revealTimer)
    revealTimer = null
  }
})
</script>

<template>
  <Transition name="cta-slide">
    <div
      v-if="visible && !dismissed"
      class="fixed bottom-0 left-0 right-0 bg-utah-blue text-white flex items-center justify-between px-4 py-3 shadow-lg z-50"
      role="region"
      aria-label="Subscribe call to action"
    >
      <p class="text-sm font-medium">
        Get weekly Utah startup updates &rarr;
      </p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-semibold rounded border border-white text-white hover:bg-white hover:text-utah-blue transition-colors"
          @click="handleSubscribeClick"
        >
          Subscribe
        </button>
        <button
          type="button"
          class="w-8 h-8 inline-flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-utah-blue-dark"
          aria-label="Dismiss"
          @click="handleDismiss"
        >
          &#x2715;
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cta-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.cta-slide-enter-active {
  transition: transform 0.35s ease-out, opacity 0.35s ease-out;
}
.cta-slide-enter-to {
  transform: translateY(0);
  opacity: 1;
}
.cta-slide-leave-from {
  transform: translateY(0);
  opacity: 1;
}
.cta-slide-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}
.cta-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
