<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  loadSpotifySDK, spotifyAccessToken, spotifyAuth, spotifyLoginUrl,
  type SpotifyPlayer, type SpotifyState,
} from '../spotify'
import spotifyLogoUrl from '../assets/svg/Spotify_icon.svg'

const props = defineProps<{ trackId: string }>()
const emit = defineEmits<{ playing: [] }>()
const route = useRoute()
const router = useRouter()
const configured = ref(false)
const authenticated = ref(false)
const checking = ref(true)
const busy = ref(false)
const isPlaying = ref(false)
const position = ref(0)
const duration = ref(0)
const volume = ref(0.5)
const error = ref<string | null>(null)
let player: SpotifyPlayer | undefined
let deviceId: string | undefined
let active = true
let progressTimer: ReturnType<typeof setInterval> | undefined
let cancelConnection: (() => void) | undefined
const playbackController = new AbortController()
const uri = computed(() => `spotify:track:${props.trackId}`)
const loginUrl = computed(() => spotifyLoginUrl(router.resolve(route.fullPath).href))

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

async function checkStatus(): Promise<void> {
  checking.value = true
  error.value = null
  try {
    const status = await spotifyAuth<{ configured: boolean; authenticated: boolean; error?: string }>('status')
    if (!active) return
    configured.value = status.configured
    authenticated.value = status.authenticated
    error.value = status.error ?? null
    if (status.authenticated) await connect()
  } catch (reason) {
    if (active) {
      error.value ??= message(reason)
      disconnect()
    }
  } finally {
    if (active) checking.value = false
  }
}
onMounted(checkStatus)

function updateState(state: SpotifyState | null): void {
  if (!active) return
  const playing = Boolean(state && !state.paused)
  if (playing && !isPlaying.value) emit('playing')
  isPlaying.value = playing
  if (state) {
    position.value = state.position
    duration.value = state.duration
  }
}

function disconnect(): void {
  cancelConnection?.()
  cancelConnection = undefined
  clearInterval(progressTimer)
  progressTimer = undefined
  player?.disconnect()
  player = undefined
  deviceId = undefined
  isPlaying.value = false
}

async function connect(): Promise<SpotifyPlayer | undefined> {
  if (player && deviceId) return player
  disconnect()
  const sdk = await loadSpotifySDK()
  if (!active) return
  const next = new sdk.Player({
    name: 'moongas mediatunes',
    volume: volume.value,
    getOAuthToken: (callback) => {
      void spotifyAccessToken().then((token) => {
        if (active && player === next) callback(token)
      }).catch((reason: unknown) => {
        if (active && player === next) {
          error.value ??= message(reason)
          authenticated.value = false
          disconnect()
        }
      })
    },
  })
  player = next
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => fail({ message: 'Spotify did not become ready. Retry playback.' }), 20000)
    cancelConnection = () => {
      clearTimeout(timeout)
      reject(new Error('Spotify connection was closed.'))
    }
    const fail = ({ message: text }: { message: string }) => {
      clearTimeout(timeout)
      if (active && player === next) {
        cancelConnection = undefined
        error.value = text
        disconnect()
      }
      reject(new Error(text))
    }
    for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error'] as const) {
      next.addListener(event, (value) => {
        if (active && player === next && event === 'authentication_error') authenticated.value = false
        fail(value)
      })
    }
    next.addListener('ready', ({ device_id }) => {
      clearTimeout(timeout)
      if (active && player === next) {
        cancelConnection = undefined
        deviceId = device_id
      }
      resolve()
    })
    next.addListener('not_ready', () => {
      if (active && player === next) {
        deviceId = undefined
        isPlaying.value = false
        error.value = 'Spotify device went offline. Retry playback.'
      }
    })
    next.addListener('player_state_changed', (state) => {
      if (player === next) updateState(state)
    })
    void next.connect().then((connected) => {
      if (!connected) fail({ message: 'Unable to connect Spotify. Check Premium access and browser DRM support.' })
    }).catch((reason: unknown) => fail({ message: message(reason) }))
  })
  if (!active || player !== next) return
  progressTimer = setInterval(() => {
    void next.getCurrentState().then((state) => {
      if (player === next) updateState(state)
    }).catch((reason: unknown) => {
      if (active && player === next) error.value = message(reason)
    })
  }, 1000)
  return next
}

async function togglePlayback(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    if (!player || !deviceId) {
      await connect()
      return
    }
    // Must be invoked during the click, before any token or SDK network request.
    const current = player
    await current.activateElement()
    if (!active || player !== current) return
    const state = await current.getCurrentState()
    if (!active || player !== current) return
    if (state?.track_window.current_track.uri === uri.value && state.position < state.duration) {
      if (state.paused) {
        emit('playing')
        await current.resume()
      } else {
        await current.pause()
      }
    } else {
      const token = await spotifyAccessToken()
      if (!active || player !== current || !deviceId) return
      emit('playing')
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?${new URLSearchParams({ device_id: deviceId })}`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ uris: [uri.value] }),
        signal: playbackController.signal,
      })
      if (!response.ok) throw new Error(`Spotify playback failed (${response.status}). Check your Premium account, app access, and track availability.`)
    }
  } catch (reason) {
    if (active) {
      error.value ??= message(reason)
      disconnect()
    }
  } finally {
    if (active) busy.value = false
  }
}

async function pause(): Promise<void> {
  if (!player || !deviceId) return
  try {
    await player.pause()
  } catch (reason) {
    if (active) error.value = message(reason)
  }
}

async function seek(event: Event): Promise<void> {
  try {
    await player?.seek(Number((event.target as HTMLInputElement).value))
  } catch (reason) {
    if (active) error.value = message(reason)
  }
}

async function changeVolume(event: Event): Promise<void> {
  volume.value = Number((event.target as HTMLInputElement).value)
  try {
    await player?.setVolume(volume.value)
  } catch (reason) {
    if (active) error.value = message(reason)
  }
}

async function logout(): Promise<void> {
  disconnect()
  busy.value = true
  try {
    await spotifyAuth('logout', 'POST')
    authenticated.value = false
    error.value = null
  } catch (reason) {
    if (active) error.value = message(reason)
  } finally {
    if (active) busy.value = false
  }
}

function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

onUnmounted(() => {
  active = false
  playbackController.abort()
  disconnect()
})
defineExpose({ pause })
</script>

<template>
  <section class="spotify-player" aria-label="Spotify player">
    <a class="spotify-track" :href="`https://open.spotify.com/track/${trackId}`" target="_blank" rel="noopener noreferrer">
      <img :src="spotifyLogoUrl" alt="" /> Spotify
    </a>
    <p v-if="checking" role="status">Checking Spotify connection...</p>
    <template v-else-if="authenticated">
      <div class="spotify-controls">
        <button class="button-link" :disabled="busy" :aria-label="isPlaying ? 'Pause Spotify' : 'Play Spotify'" @click="togglePlayback">
          {{ isPlaying ? 'Pause' : 'Play' }}
        </button>
        <span>{{ formatTime(position) }} / {{ formatTime(duration) }}</span>
        <input type="range" aria-label="Spotify playback position" min="0" :max="duration" :value="position" :disabled="!duration || busy" @change="seek" />
        <label>Volume <input type="range" aria-label="Spotify volume" min="0" max="1" step="0.01" :value="volume" @input="changeVolume" /></label>
      </div>
      <p v-if="busy" role="status">Connecting to Spotify...</p>
      <button class="button-link" :disabled="busy" @click="logout">Disconnect Spotify</button>
    </template>
    <a v-else-if="configured" class="button-link" :href="loginUrl">Connect Spotify Premium</a>
    <p v-else-if="!error">Set SPOTIFY_API_CLIENT_ID and SPOTIFY_API_CLIENT_SECRET on the web server to enable Spotify playback.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <button v-if="error && !authenticated" class="button-link" @click="checkStatus">Retry connection check</button>
  </section>
</template>

<style scoped>
.spotify-player {
  max-width: 822px;
  margin: 12px auto;
  padding: 16px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #333;
  font-size: 0.65em;
}

.spotify-track,
.spotify-controls,
.spotify-controls label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spotify-track img {
  width: 24px;
  height: 24px;
}

.spotify-controls {
  flex-wrap: wrap;
}

.spotify-controls input {
  max-width: 100%;
}
</style>
