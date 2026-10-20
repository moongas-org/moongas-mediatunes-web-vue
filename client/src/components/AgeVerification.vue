<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import {
  ageConfirmed,
  ageVerificationRequested,
  automaticallyUnblur,
  confirmAge,
  dismissAgeVerification,
  unblurRequestedCover,
} from '../ageVerificationStore'

const error = ref<string | null>(null)
const autoUnblur = ref(false)
const visible = ageVerificationRequested
const modal = ref<HTMLDivElement | null>(null)
let previousFocus: HTMLElement | null = null

watch(
  visible,
  async (v) => {
    document.body.classList.toggle('age-verification-active', v)
    error.value = null
    if (v) {
      autoUnblur.value = automaticallyUnblur.value
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      modal.value?.querySelector<HTMLElement>('input, button')?.focus()
    } else {
      previousFocus?.focus()
    }
  },
  { immediate: true },
)

watch(ageConfirmed, async () => {
  if (!visible.value) return
  await nextTick()
  modal.value?.querySelector<HTMLElement>('input, button')?.focus()
})

function trapFocus(event: KeyboardEvent): void {
  const controls = modal.value?.querySelectorAll<HTMLElement>('input, button')
  if (!controls?.length) return
  const first = controls[0]
  const last = controls[controls.length - 1]
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

function unblur(): void {
  error.value = null
  try {
    unblurRequestedCover(autoUnblur.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
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
      <h1 id="age-verification-title">{{ ageConfirmed ? 'Unblur album cover' : 'Content Warning' }}</h1>
      <template v-if="!ageConfirmed">
        <p>This website contains content intended for mature audiences only (18+).</p>
        <p>Are you 18 years or older?</p>
      </template>
      <label v-else>
        <input v-model="autoUnblur" type="checkbox" />
        Automatically unblur explicit album covers
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <template v-if="!ageConfirmed">
        <button id="age-yes" @click="yes">Yes, I am 18+</button>
        <button id="age-no" @click="no">No, exit</button>
      </template>
      <button v-else type="button" @click="unblur">Unblur</button>
      <button type="button" @click="dismissAgeVerification">Cancel</button>
    </div>
  </div>
</template>
