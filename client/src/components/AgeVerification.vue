<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ageVerificationRequested, confirmAge, dismissAgeVerification } from '../ageVerificationStore'

const error = ref<string | null>(null)
const visible = ageVerificationRequested
const modal = ref<HTMLDivElement | null>(null)
let previousFocus: HTMLElement | null = null

watch(
  visible,
  async (v) => {
    document.body.classList.toggle('age-verification-active', v)
    error.value = null
    if (v) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      modal.value?.querySelector('button')?.focus()
    } else {
      previousFocus?.focus()
    }
  },
  { immediate: true },
)

function trapFocus(event: KeyboardEvent): void {
  const buttons = modal.value?.querySelectorAll('button')
  if (!buttons?.length) return
  const first = buttons[0]
  const last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function yes(): void {
  error.value = null
  try {
    confirmAge()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function no(): void {
  // Redirect if they are not old enough
  window.location.href = 'https://www.youtube.com/@msrachel'
}
</script>

<template>
  <!-- v-if controls presence, so display:flex inline (CSS has display:none by default,
       which the original inline script overrode via element.style) -->
  <div v-if="visible" id="age-verification-overlay" style="display: flex">
    <div
      ref="modal"
      id="age-verification-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-verification-title"
      @keydown.esc="dismissAgeVerification"
      @keydown.tab="trapFocus"
    >
      <h1 id="age-verification-title">Content Warning</h1>
      <p>This website contains content intended for mature audiences only (18+).</p>
      <p>Are you 18 years or older?</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button id="age-yes" @click="yes">Yes, I am 18+</button>
      <button id="age-no" @click="no">No, exit</button>
      <button type="button" @click="dismissAgeVerification">Cancel</button>
    </div>
  </div>
</template>
