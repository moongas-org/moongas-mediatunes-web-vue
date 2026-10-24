<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getfileUrl } from '../api'
import { countryName, regionName } from '../data/geoFilters'
import type { TrackInfo } from '../types'

/**
 * TypeScript/Vue port of hints.js + hints.html ("name that tune" mode).
 */
const props = defineProps<{
  track: TrackInfo | null
}>()

const emit = defineEmits<{
  reveal: []
}>()

type LetterHintKey = 'artist' | 'title' | 'album'
/** Letter-by-letter hints; each click shows one more letter of the field. */
const LETTER_HINTS: { key: LetterHintKey; label: string; id: string }[] = [
  { key: 'artist', label: 'Artist', id: 'Artist' },
  { key: 'title', label: 'Title', id: 'Title' },
  { key: 'album', label: 'Album', id: 'Album' },
]
const MAX_LETTER_HINTS = 9

type ValueHintKey = 'year' | 'country' | 'region' | 'city' | 'cover'
/** One-click hints that show a whole value. */
const VALUE_HINTS: { key: ValueHintKey; label: string; id: string; icon: string }[] = [
  { key: 'year', label: 'Year', id: 'Year', icon: 'bi-calendar-event-fill' },
  { key: 'country', label: 'Country', id: 'Country', icon: 'bi-globe-americas' },
  { key: 'region', label: 'Region', id: 'Region', icon: 'bi-map-fill' },
  { key: 'city', label: 'City', id: 'City', icon: 'bi-buildings-fill' },
  { key: 'cover', label: 'Album Cover (Blurred)', id: 'Cover', icon: 'bi-images' },
]

function noValueHints(): Record<ValueHintKey, boolean> {
  return { year: false, country: false, region: false, city: false, cover: false }
}

/** Which value hints are shown. */
const shownValues = ref(noValueHints())
/** Number of letters shown per letter hint. */
const letterCounts = ref<Record<LetterHintKey, number>>({ artist: 0, title: 0, album: 0 })
/** Once details are shown, hints are locked (matches hideAndLockHints()). */
const revealed = ref(false)

function resetLetters(): void {
  letterCounts.value = { artist: 0, title: 0, album: 0 }
}

/** resetHints() from hints.js */
function reset(): void {
  shownValues.value = noValueHints()
  resetLetters()
  revealed.value = false
}

defineExpose({ reset })

watch(() => props.track, reset)

const revealDialog = ref<HTMLDialogElement | null>(null)

/** Asks for confirmation before revealing; the dialog's buttons call revealAll() or close it. */
function confirmReveal(): void {
  revealDialog.value?.showModal()
}

function revealAll(): void {
  revealDialog.value?.close()
  revealed.value = true
  shownValues.value = noValueHints()
  resetLetters()
  emit('reveal')
}

/** Display text per value hint; geo codes are shown as names. */
const valueHints = computed(() => {
  const t = props.track
  const text: Record<ValueHintKey, string> = {
    year: t?.year ? String(t.year) : '',
    country: t?.countryCode ? countryName(t.countryCode) : '',
    region: t?.regionCode ? regionName(t.regionCode) : '',
    city: t?.city ?? '',
    cover: t?.coverPath ?? '',
  }
  return VALUE_HINTS.map((h) => ({ ...h, text: text[h.key] || '(unknown)' }))
})

const textValueHints = computed(() => valueHints.value.filter((h) => h.key !== 'cover'))

/**
 * State for each letter hint. Whitespace is shown but not counted as a letter;
 * characters are split by code point so accents/emoji aren't broken up.
 */
const letterHints = computed(() =>
  LETTER_HINTS.map(({ key, label, id }) => {
    const value = props.track?.[key] ?? ''
    const chars = Array.from(value)
    const total = chars.filter((c) => c.trim() !== '').length
    const count = letterCounts.value[key]
    let letters = 0
    let end = 0
    for (const c of chars) {
      if (letters === count) break
      end++
      if (c.trim() !== '') letters++
    }
    const prefix = chars.slice(0, end).join('')
    return {
      key,
      label,
      id,
      count,
      done: count >= Math.min(total, MAX_LETTER_HINTS),
      text: prefix + (prefix.trimEnd() === value.trimEnd() ? '' : '…'),
    }
  }),
)

function showNextLetter(key: LetterHintKey): void {
  const hint = letterHints.value.find((h) => h.key === key)
  if (hint && !hint.done) letterCounts.value[key]++
}
</script>

<template>
  <div>
    Hints:
    <button
      v-for="h in valueHints"
      :key="h.key"
      :id="`hint${h.id}Btn`"
      class="button-link"
      :disabled="shownValues[h.key] || revealed"
      @click="shownValues[h.key] = true"
    >
      {{ h.label }} <i class="bi" :class="h.icon"></i>
    </button>
    <button
      v-for="h in letterHints"
      :key="h.key"
      :id="`hint${h.id}LetterBtn`"
      class="button-link"
      :disabled="h.done || revealed"
      @click="showNextLetter(h.key)"
    >
      {{ h.label }} Letter <i class="bi" :class="`bi-${h.count}-circle-fill`"></i>
    </button>
    <div
      v-for="h in textValueHints"
      :key="h.key"
      :id="`hint${h.id}`"
      class="hint"
      v-show="shownValues[h.key] && !revealed"
    >
      {{ h.label }}: {{ h.text }}
    </div>
    <div
      v-for="h in letterHints"
      :key="h.key"
      :id="`hint${h.id}Letters`"
      class="hint"
      v-show="h.count > 0 && !revealed"
    >
      {{ h.label }}: {{ h.text }}
    </div>
    <div id="hintCover" class="hint" v-if="shownValues.cover && !revealed">
      <div v-if="track?.coverPath" class="hint-cover">
        <img :src="getfileUrl(track.coverPath)" alt="Blurred album cover" width="1000" height="1000" />
      </div>
      <template v-else>Album Cover: (unknown)</template>
    </div>
    <div id="revealSection">
      <button id="showBtn" class="button-link" :disabled="revealed" @click="confirmReveal">
        Reveal <i class="bi bi-question-circle-fill"></i>
      </button>
    </div>
    <dialog
      ref="revealDialog"
      id="revealConfirmDialog"
      aria-labelledby="revealConfirmMessage"
      @click.self="revealDialog?.close()"
    >
      <p id="revealConfirmMessage">Are you sure you want to reveal all track information?</p>
      <div class="dialog-buttons">
        <button id="revealConfirmBtn" class="button-link" @click="revealAll">
          Reveal <i class="bi bi-question-circle-fill"></i>
        </button>
        <button id="revealCancelBtn" class="button-link" autofocus @click="revealDialog?.close()">
          Cancel
        </button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
/* Same blur as AlbumCover's .explicit-cover-blurred. */
.hint-cover {
  width: 822px;
  max-width: 100%;
  margin: 10px auto;
}

.hint-cover img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
  filter: blur(40px);
  clip-path: inset(0);
}

#revealSection {
  margin: 10px;
}

#revealConfirmDialog {
  padding: 30px;
  max-width: 400px;
  width: 90%;
  border: 0;
  border-radius: 12px;
  background-color: #333;
  color: white;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

#revealConfirmDialog::backdrop {
  background-color: rgba(0, 0, 0, 0.9);
}

#revealConfirmDialog .dialog-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

#revealConfirmDialog .button-link {
  margin: 0;
  padding-inline: 20px;
  background-color: #555;
}

#revealConfirmDialog .button-link:hover {
  background-color: #7b3f3f;
}
</style>
