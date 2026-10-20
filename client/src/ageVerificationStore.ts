import { readonly, ref } from 'vue'

function hasCookie(name: string, value = 'true'): boolean {
  return document.cookie.split(';').some((cookie) => cookie.trim() === `${name}=${value}`)
}

function saveCookie(name: string, value: boolean, error: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${value}; Path=${import.meta.env.BASE_URL}; Max-Age=31536000; SameSite=Lax${secure}`
  if (!hasCookie(name, String(value))) throw new Error(error)
}

const confirmed = ref(hasCookie('ageConfirmed'))
export const ageConfirmed = readonly(confirmed)
const automatic = ref(hasCookie('autoUnblurExplicitCovers'))
export const automaticallyUnblur = readonly(automatic)
const requested = ref(false)
export const ageVerificationRequested = readonly(requested)
let unblurCover: (() => void) | undefined

export function requestAgeVerification(unblur: () => void): void {
  unblurCover = unblur
  requested.value = true
}

export function dismissAgeVerification(): void {
  requested.value = false
  unblurCover = undefined
}

export function confirmAge(): void {
  saveCookie('ageConfirmed', true, 'Unable to save age verification. Please enable cookies and try again.')
  confirmed.value = true
}

export function unblurRequestedCover(autoUnblur: boolean): void {
  if (!confirmed.value) {
    throw new Error('Please verify your age before unblurring album art.')
  }
  saveCookie('autoUnblurExplicitCovers', autoUnblur, 'Unable to save your unblur preference. Please enable cookies and try again.')
  automatic.value = autoUnblur
  unblurCover?.()
  dismissAgeVerification()
}
