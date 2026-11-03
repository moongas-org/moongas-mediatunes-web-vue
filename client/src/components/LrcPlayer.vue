<script setup lang="ts">
import { computed } from 'vue'
import { activeLrcIndex, type LrcLine } from '../utils/lrc'

const props = defineProps<{ lines: readonly LrcLine[]; position: number }>()
const activeIndex = computed(() => activeLrcIndex(props.lines, props.position))
const visibleLines = computed(() => {
  const center = Math.max(0, activeIndex.value)
  const start = Math.max(0, center - 2)
  return props.lines.slice(start, center + 3).map((line, index) => ({ ...line, index: start + index }))
})
</script>

<template>
  <section class="lrc-player" aria-label="Karaoke lyrics">
    <div class="lrc-lines">
      <p
        v-for="line in visibleLines"
        :key="line.index"
        :class="{ 'lrc-active': line.index === activeIndex }"
        :aria-current="line.index === activeIndex ? 'true' : undefined"
      >{{ line.text || '\u00a0' }}</p>
    </div>
  </section>
</template>

<style scoped>
.lrc-player {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.65);
  color: #ddd;
  text-align: center;
  font-size: clamp(14px, 4cqi, 32px);
  text-shadow: 0 2px 4px black;
}

.lrc-lines {
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.lrc-lines p {
  margin: 0.5em 0;
  overflow-wrap: anywhere;
}

.lrc-lines .lrc-active {
  color: white;
  font-weight: bold;
  font-size: 1.2em;
}
</style>
