<script setup lang="ts">
import { onMounted, onUnmounted, onUpdated, ref } from 'vue'

defineProps<{ paused?: boolean; enabled: boolean }>()

const viewport = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const distance = ref(0)
let observer: ResizeObserver | undefined

function measure(): void {
  if (!viewport.value || !content.value) return
  distance.value = Math.max(0, content.value.scrollWidth - viewport.value.clientWidth)
}

onMounted(() => {
  observer = new ResizeObserver(measure)
  if (viewport.value) observer.observe(viewport.value)
  if (content.value) observer.observe(content.value)
  measure()
})
onUpdated(measure)
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <span
    ref="viewport"
    class="panning-text"
    :class="{ overflowing: distance > 0, paused, 'motion-enabled': enabled }"
    :style="{ '--pan-distance': `${-distance}px`, '--pan-duration': `${Math.max(12, distance / 15)}s` }"
  >
    <span ref="content" class="panning-text-content"><slot /></span>
  </span>
</template>

<style scoped>
.panning-text {
  display: block;
  overflow: hidden;
}

.panning-text-content {
  display: inline-block;
  white-space: nowrap;
}

.motion-enabled.overflowing .panning-text-content {
  animation: text-pan var(--pan-duration) linear infinite alternate;
}

.paused .panning-text-content {
  animation-play-state: paused;
}

.panning-text:focus-within .panning-text-content {
  animation: none;
  white-space: normal;
  overflow-wrap: anywhere;
}

@keyframes text-pan {
  0%, 10% { transform: translateX(0); }
  90%, 100% { transform: translateX(var(--pan-distance)); }
}

.panning-text:not(.motion-enabled) .panning-text-content {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
