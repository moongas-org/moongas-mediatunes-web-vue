import { readonly, ref } from 'vue'

function hasAgeConfirmation(): boolean {
  return document.cookie.split(';').some((cookie) => cookie.trim() === 'ageConfirmed=true')
}

const confirmed = ref(hasAgeConfirmation())
export const ageConfirmed = readonly(confirmed)
const requested = ref(false)
export const ageVerificationRequested = readonly(requested)

export function requestAgeVerification(): void {
  requested.value = true
}

export function dismissAgeVerification(): void {
  requested.value = false
}

export function confirmAge(): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `ageConfirmed=true; Path=${import.meta.env.BASE_URL}; Max-Age=31536000; SameSite=Lax${secure}`
  confirmed.value = hasAgeConfirmation()
  if (!confirmed.value) {
    throw new Error('Unable to save age verification. Please enable cookies and try again.')
  }
  dismissAgeVerification()
}
