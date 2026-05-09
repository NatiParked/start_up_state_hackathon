// Tiny global store — replace with Pinia if you outgrow this.
import { reactive } from 'vue'
export const quizState = reactive({ stage: null, industry: null, topic: null, location: null })
