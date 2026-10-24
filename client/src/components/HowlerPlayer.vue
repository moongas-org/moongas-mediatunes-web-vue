<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Howl } from 'howler'

const props = defineProps<{
  src?: string
  autoplay: boolean
  title?: string
  artist?: string
  album?: string
}>()
const emit = defineEmits<{ ended: []; next: []; previous: [] }>()

const isPlaying = ref(false)
const loading = ref(false)
const position = ref(0)
const duration = ref(0)
const volume = ref(1)
const error = ref<string | null>(null)
const retry = ref(0)
let loadFailed = false
let autoplayOnLoad = false
let sound: Howl | null = null
let progressTimer: ReturnType<typeof setInterval> | undefined

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const seekText = computed(() => `${formatTime(position.value)} of ${formatTime(duration.value)}`)

function updateProgress(): void {
  if (!sound) return
  const length = sound.duration()
  duration.value = Number.isFinite(length) ? length : 0
  const seek = sound.seek()
  position.value = typeof seek === 'number' && Number.isFinite(seek) ? seek : 0
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && duration.value > 0) {
    navigator.mediaSession.setPositionState({
      duration: duration.value,
      position: Math.min(position.value, duration.value),
      playbackRate: 1,
    })
  }
}

function stopProgress(): void {
  clearInterval(progressTimer)
  progressTimer = undefined
}

watch(
  () => [props.src, retry.value] as const,
  ([src], previous, onCleanup) => {
    isPlaying.value = false
    position.value = 0
    duration.value = 0
    error.value = null
    loading.value = Boolean(src)
    loadFailed = false
    if (!src) return
    autoplayOnLoad = props.autoplay || Boolean(previous && previous[0] === src)
    const next = new Howl({
      src: [src],
      // Stream with byte-range seeking and native background media events.
      html5: true,
      preload: true,
      volume: volume.value,
      onload: () => {
        if (sound !== next) return
        loading.value = false
        updateProgress()
        if (autoplayOnLoad) play()
      },
      onplay: () => {
        if (sound !== next) return
        error.value = null
        isPlaying.value = true
        setPlaybackState('playing')
        stopProgress()
        updateProgress()
        progressTimer = setInterval(updateProgress, 250)
      },
      onpause: () => {
        if (sound !== next) return
        isPlaying.value = false
        setPlaybackState('paused')
        stopProgress()
        updateProgress()
      },
      onseek: () => {
        if (sound === next) updateProgress()
      },
      onend: () => {
        if (sound !== next) return
        isPlaying.value = false
        stopProgress()
        updateProgress()
        emit('ended')
      },
      onloaderror: (_id, reason) => {
        if (sound !== next) return
        loading.value = false
        loadFailed = true
        isPlaying.value = false
        setPlaybackState('paused')
        stopProgress()
        error.value = `Unable to load audio (${reason}). Press Play to retry.`
      },
      onplayerror: (_id, reason) => {
        if (sound !== next) return
        isPlaying.value = false
        setPlaybackState('paused')
        stopProgress()
        error.value = `Unable to play audio (${reason}). Press Play to retry.`
      },
    })
    sound = next
    onCleanup(() => {
      sound = null
      stopProgress()
      next.unload()
    })
  },
  { immediate: true },
)

function play(): void {
  autoplayOnLoad = true
  if (loadFailed) {
    retry.value++
    return
  }
  if (!sound) return
  if (loading.value) return
  error.value = null
  sound.play()
}

function togglePlayback(): void {
  if (sound?.playing()) pause()
  else play()
}

function pause(): void {
  autoplayOnLoad = false
  sound?.pause()
  setPlaybackState('paused')
}

function restart(): void {
  if (!sound) return
  sound.seek(0)
  position.value = 0
  if (!sound.playing()) play()
}

function seek(event: Event): void {
  if (!sound || duration.value <= 0) return
  const value = Number((event.target as HTMLInputElement).value)
  sound.seek(value)
  position.value = value
}

function changeVolume(event: Event): void {
  volume.value = Number((event.target as HTMLInputElement).value)
  sound?.volume(volume.value)
}

function setPlaybackState(state: MediaSessionPlaybackState): void {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state
}

watch(
  () => [props.title, props.artist, props.album],
  () => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: props.title || 'moongas mediatunes',
      artist: props.artist || '',
      album: props.album || '',
    })
  },
  { immediate: true },
)

const mediaActions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
  play,
  pause,
  stop: () => {
    autoplayOnLoad = false
    sound?.stop()
    isPlaying.value = false
    stopProgress()
    updateProgress()
    setPlaybackState('none')
  },
  nexttrack: () => emit('next'),
  previoustrack: () => emit('previous'),
  seekto: ({ seekTime }) => {
    if (seekTime !== undefined) sound?.seek(seekTime)
  },
  seekbackward: ({ seekOffset }) => { sound?.seek(Math.max(0, position.value - (seekOffset ?? 10))) },
  seekforward: ({ seekOffset }) => { sound?.seek(Math.min(duration.value, position.value + (seekOffset ?? 10))) },
}
const registeredActions: MediaSessionAction[] = []
if ('mediaSession' in navigator) {
  for (const action of Object.keys(mediaActions) as MediaSessionAction[]) {
    try {
      navigator.mediaSession.setActionHandler(action, mediaActions[action] ?? null)
      registeredActions.push(action)
    } catch (reason) {
      console.warn(`Media session action ${action} is unavailable`, reason)
    }
  }
}

onUnmounted(() => {
  stopProgress()
  if ('mediaSession' in navigator) {
    for (const action of registeredActions) navigator.mediaSession.setActionHandler(action, null)
    navigator.mediaSession.metadata = null
    setPlaybackState('none')
  }
})
defineExpose({ togglePlayback, restart })
</script>

<template>
  <div class="howler-player" role="group" aria-label="Audio player">
    <div class="playback-row">
      <button
        id="playBtn"
        class="button-link"
        :disabled="!src || loading"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlayback"
      >
        <i :class="isPlaying ? 'bi bi-pause-circle-fill' : 'bi bi-play-circle-fill'" aria-hidden="true"></i>
        {{ isPlaying ? 'Pause' : 'Play' }}
      </button>
      <span class="playback-time">{{ formatTime(position) }}</span>
      <input
        class="playback-progress"
        type="range"
        aria-label="Playback position"
        :aria-valuetext="seekText"
        min="0"
        :max="duration || 0"
        step="0.1"
        :value="position"
        :disabled="loading || duration <= 0"
        @input="seek"
      />
      <span class="playback-time">{{ formatTime(duration) }}</span>
      <label class="volume-control">
        <i class="bi bi-volume-up-fill" aria-hidden="true"></i>
        <input type="range" aria-label="Volume" min="0" max="1" step="0.01" :value="volume" @input="changeVolume" />
      </label>
    </div>
    <div v-if="loading" class="playback-status" role="status">Loading audio...</div>
    <div v-if="error" class="error playback-status" role="alert">{{ error }}</div>
  </div>
</template>

<style scoped>
.howler-player {
  max-width: 822px;
  margin: 12px auto;
  padding: 8px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #333;
}

.playback-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.playback-progress {
  flex: 1;
  min-width: 80px;
}

.playback-time {
  font-size: 0.6em;
  font-variant-numeric: tabular-nums;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7em;
}

.volume-control input {
  width: 70px;
}

input[type='range'] {
  accent-color: #ab16f6;
  cursor: pointer;
}

input:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}

.playback-status {
  font-size: 0.6em;
}
</style>
