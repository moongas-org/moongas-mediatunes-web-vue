<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, type LocationQuery, type RouteLocationRaw } from 'vue-router'
import { api, buildSearchParams, getfileUrl } from '../api'
import { ageConfirmed, automaticallyUnblur, requestAgeVerification } from '../ageVerificationStore'

const props = withDefaults(defineProps<{
  coverPath: string
  query: LocationQuery
  alt: string
  to?: RouteLocationRaw
  actionLabel?: string
  enabled?: boolean
}>(), { enabled: true })

const emit = defineEmits<{ activate: []; settled: [] }>()
const explicitCover = ref<boolean | null>(null)
const error = ref<string | null>(null)
const ready = ref(false)
const revealed = ref(false)
const requestKey = computed(() => JSON.stringify([props.coverPath, buildSearchParams(props.query).toString()]))
let controller: AbortController | undefined
let metadataStarted = false
const blurred = computed(() =>
  explicitCover.value !== false && !revealed.value && !(ageConfirmed.value && automaticallyUnblur.value),
)
const revealLabel = computed(() => ageConfirmed.value ? 'Unblur' : 'Verify your age to reveal')
const title = computed(() => error.value ?? (blurred.value ? `${revealLabel.value} album art.` : undefined))

function verifyIfBlurred(event: MouseEvent): void {
  if (!ready.value || blurred.value) {
    event.preventDefault()
    event.stopPropagation()
    if (ready.value) {
      const currentController = controller
      requestAgeVerification(() => {
        if (currentController && !currentController.signal.aborted) revealed.value = true
      })
    }
  }
}

watch(
  [() => props.enabled, requestKey],
  (_, __, onCleanup) => {
    controller = props.enabled ? new AbortController() : undefined
    const currentController = controller
    onCleanup(() => { currentController?.abort() })
    explicitCover.value = null
    error.value = null
    ready.value = false
    revealed.value = false
    metadataStarted = false
  },
  { immediate: true },
)

async function onImageFinished(event: Event): Promise<void> {
  const image = event.currentTarget
  const currentController = controller
  if (
    !(image instanceof HTMLImageElement) ||
    image.dataset.requestKey !== requestKey.value ||
    !currentController ||
    currentController.signal.aborted ||
    metadataStarted
  ) return
  metadataStarted = true
  if (event.type === 'error') {
    error.value = `Failed to load album cover image: ${image.src}`
    console.error(error.value)
  }
  try {
    const data = await api.album(props.query, currentController.signal)
    if (typeof data.album.explicitCover !== 'boolean') {
      throw new Error('Album metadata is missing the explicitCover flag.')
    }
    if (currentController.signal.aborted) return
    explicitCover.value = data.album.explicitCover
  } catch (e) {
    if (currentController.signal.aborted) return
    error.value = `Failed to load album cover metadata. ${e instanceof Error ? e.message : String(e)}`
    console.error(error.value)
  }
  if (currentController.signal.aborted) return
  ready.value = true
  await nextTick()
  // Give the completed cover a paint before the grid starts the next download.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!currentController.signal.aborted) emit('settled')
    })
  })
}
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    class="album-cover"
    :title="title"
    :aria-label="blurred ? `${revealLabel} ${alt}` : (actionLabel ?? alt)"
    :aria-haspopup="blurred ? 'dialog' : undefined"
    :aria-busy="!ready"
    @click.capture="verifyIfBlurred"
    @click="emit('activate')"
  >
    <img
      :key="requestKey"
      :data-request-key="requestKey"
      :src="enabled ? getfileUrl(coverPath) : undefined"
      :alt="alt"
      :class="{ 'explicit-cover-blurred': blurred }"
      :style="{ visibility: ready ? 'visible' : 'hidden' }"
      width="1000"
      height="1000"
      @load="onImageFinished"
      @error="onImageFinished"
    />
    <slot />
  </component>
</template>

<style scoped>
.album-cover {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.album-cover img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
}

.explicit-cover-blurred {
  filter: blur(40px);
  clip-path: inset(0);
}
</style>
