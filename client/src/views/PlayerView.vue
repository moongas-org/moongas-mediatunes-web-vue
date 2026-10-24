<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, buildSearchParams, getfileUrl } from '../api'
import AlbumCover from '../components/AlbumCover.vue'
import { configState } from '../configStore'
import { GENRES } from '../data/genres'
import HintsPanel from '../components/HintsPanel.vue'
import QueryFilters from '../components/QueryFilters.vue'
import { useGeoFilterFields } from '../data/geoFilters'
import WebSearchLinks from '../components/WebSearchLinks.vue'
import mp3LogoUrl from '../assets/svg/mp3_logo.svg'
import {
  canGoBack,
  currentHistoryTrack,
  historyFilters,
  moveHistory,
  pushHistory,
} from '../playHistory'
import type { FilterField, TrackInfo } from '../types'

/**
 * Port of player.html, including its inline jQuery script.
 *
 * Behavior: shows a random track matching the query-string filters; when local
 * playback is enabled, streams the file via /getfile and auto-advances to the
 * next random track when playback ends. Played tracks are kept in a cookie
 * history (see playHistory.ts) for the Previous/Next buttons, and the player
 * resumes the most recent track. With ?hints=1 ("name that tune"),
 * track details and cover are hidden until the user reveals them.
 */
const props = defineProps<{ hints?: boolean }>()

const route = useRoute()

const track = ref<TrackInfo | null>(null)
const error = ref<string | null>(null)
const isPlaying = ref(false)
/** Set when the next loaded track should start playing as soon as it can. */
const autoplayPending = ref(false)
/** "name that tune": details/cover stay hidden until Show Details is clicked. */
const hintsRevealed = ref(false)
const trackInfoMinimized = ref(false)

const audioRef = ref<HTMLAudioElement | null>(null)

type LyricsKind = 'txt' | 'lrc'
/** Lyrics buttons: plain-text (.txt) and synced (.lrc) lyrics files. */
const LYRICS_KINDS: { kind: LyricsKind; ext: '.txt' | '.lrc'; label: string }[] = [
  { kind: 'txt', ext: '.txt', label: 'Lyrics' },
  { kind: 'lrc', ext: '.lrc', label: 'LRC' },
]
/** Lyrics text per kind for the current track; null if unavailable / not yet loaded. */
const lyrics = ref<Record<LyricsKind, string | null>>({ txt: null, lrc: null })
const lyricsLoading = ref(false)
/** Which lyrics panel is open; only one at a time. */
const shownLyrics = ref<LyricsKind | null>(null)
/** Incremented per track so stale lyrics responses are ignored. */
let lyricsRequestId = 0

const localEnabled = computed(() => configState.config?.playbackMethodLocalEnabled ?? false)
const hintsMode = computed(() => props.hints || route.query.hints === '1')

const filterFields: FilterField[] = [
  { key: 'artist', label: 'artist', multi: true },
  { key: 'albumartist', label: 'album artist' },
  { key: 'album', label: 'album', multi: true },
  { key: 'title', label: 'title' },
  { key: 'genre', label: 'genre', multi: true, options: GENRES },
  { key: 'explicitCover', label: 'explicit cover', options: ['true', 'false'] },
  { key: 'year', label: 'year', multi: true, type: 'number' },
  { key: 'minYear', label: 'min year', type: 'number' },
  { key: 'maxYear', label: 'max year', type: 'number' },
  ...useGeoFilterFields(),
]

/** Filter params in the URL (excluding the "name that tune" hints flag). */
function currentFilters(): string {
  const params = buildSearchParams(route.query)
  params.delete('hints')
  return params.toString()
}

/** Incremented per track change so stale random-track responses are ignored. */
let trackRequestId = 0

function showTrack(next: TrackInfo, autoplay: boolean): void {
  const samePath = next.path === track.value?.path
  error.value = null
  hintsRevealed.value = false
  trackInfoMinimized.value = false
  track.value = next
  // The audio element won't reload an unchanged src, so restart it directly.
  autoplayPending.value = autoplay && !samePath
  if (autoplay && samePath) restart()
}

async function loadRandomTrack(autoplay: boolean): Promise<void> {
  const requestId = ++trackRequestId
  const filters = currentFilters()
  error.value = null
  try {
    const next = await api.randomTrack(route.query)
    if (requestId !== trackRequestId) return
    pushHistory(next, filters)
    showTrack(next, autoplay)
  } catch (e) {
    if (requestId !== trackRequestId) return
    track.value = null
    error.value = `Failed to load track(s). ${e instanceof Error ? e.message : String(e)}`
  }
}

/** Shows the previous/next track from the play history; false if there is none. */
function showHistoryTrack(step: -1 | 1, autoplay: boolean): boolean {
  const next = moveHistory(step)
  if (!next) return false
  trackRequestId++
  showTrack(next, autoplay)
  return true
}

/**
 * The player resumes the most recently played track unless the URL has
 * different filters than it was loaded with; "name that tune" always starts
 * with a new random track.
 */
watch(
  () => route.fullPath,
  () => {
    const latest = currentHistoryTrack.value
    const filters = currentFilters()
    if (!hintsMode.value && latest && (filters === '' || filters === historyFilters.value)) {
      if (latest.path !== track.value?.path) showTrack(latest, false)
      return
    }
    void loadRandomTrack(false)
  },
  { immediate: true },
)

const audioSrc = computed(() =>
  track.value && localEnabled.value ? getfileUrl(track.value.path) : undefined,
)

/**
 * Lyrics live alongside the media file with ".txt" / ".lrc" extensions.
 * They're fetched regardless of whether local playback is enabled.
 */
watch(
  () => track.value?.path,
  async (path) => {
    const requestId = ++lyricsRequestId
    lyrics.value = { txt: null, lrc: null }
    shownLyrics.value = null
    if (!path) {
      lyricsLoading.value = false
      return
    }
    lyricsLoading.value = true
    const results = await Promise.all(
      LYRICS_KINDS.map(({ ext }) => api.lyrics(path, ext).catch(() => null)),
    )
    if (requestId !== lyricsRequestId) return
    lyrics.value = { txt: results[0], lrc: results[1] }
    lyricsLoading.value = false
  },
  { immediate: true },
)

/** In "name that tune" mode, lyrics would give the answer away until revealed. */
function lyricsDisabled(kind: LyricsKind): boolean {
  return lyrics.value[kind] === null || (hintsMode.value && !hintsRevealed.value)
}

function lyricsTitle(kind: LyricsKind, label: string): string {
  if (lyricsLoading.value) return `Loading ${label}…`
  if (lyrics.value[kind] === null) return `${label} not available`
  return `Show/hide ${label}`
}

/** Toggle a lyrics panel; opening one hides the other. */
function toggleLyrics(kind: LyricsKind): void {
  if (lyricsDisabled(kind)) return
  shownLyrics.value = shownLyrics.value === kind ? null : kind
}

/** Links into the browse pages for the current track. */
const trackLinks = computed(() => {
  const t = track.value
  if (!t) return null
  return {
    album: { path: '/tracks', query: { artist: t.artist, album: t.album } },
    artist: { path: '/artist', query: { artist: t.artist } },
    albumartist: { path: '/artists', query: { albumartist: t.albumartist } },
    city: { path: '/artists', query: { city: t.city, countryCode: t.countryCode } },
    language: { path: '/artists', query: { languageCode: t.languageCode } },
    country: { path: '/artists', query: { countryCode: t.countryCode } },
    genre: { path: '/genre', query: { genre: t.genre } },
    region: { path: '/artists', query: { regionCode: t.regionCode } },
    year: { path: '/albums', query: { year: String(t.year) } },
    playLocal: {
      path: '/player',
      query: { artist: t.artist, album: t.album, title: t.title },
    },
  }
})

function togglePlayback(): void {
  const audio = audioRef.value
  if (!audio) return
  if (audio.paused) {
    void audio.play()
  } else {
    audio.pause()
  }
}

function restart(): void {
  const audio = audioRef.value
  if (!audio) return
  audio.currentTime = 0
  if (audio.paused) {
    void audio.play()
  }
}

function next(): void {
  goForward(localEnabled.value)
}

function previous(): void {
  showHistoryTrack(-1, localEnabled.value)
}

/** Replays the next track in the history if there is one, else loads a new random track. */
function goForward(autoplay: boolean): void {
  if (!showHistoryTrack(1, autoplay)) void loadRandomTrack(autoplay)
}

/** Continuous shuffle: when a track ends, advance to the next one and play it. */
function onEnded(): void {
  goForward(true)
}

function onCanPlayThrough(): void {
  const audio = audioRef.value
  if (audio && autoplayPending.value && audio.paused) {
    autoplayPending.value = false
    void audio.play()
  }
}
</script>

<template>
  <div>
    <QueryFilters :fields="filterFields" />
    <div
      v-if="track && trackLinks"
      v-show="!hintsMode || hintsRevealed"
      id="cover"
      class="player-cover"
      :class="{ 'info-minimized': trackInfoMinimized }"
    >
      <AlbumCover
        :cover-path="track.coverPath"
        :query="{ artist: track.artist, album: track.album, title: track.title, year: String(track.year) }"
        :alt="`${track.album} album cover`"
        id="coverImg"
        class="cover-toggle"
        action-label="Minimize track info"
        aria-controls="coverTrackInfo"
        :aria-expanded="!trackInfoMinimized"
        @activate="trackInfoMinimized = true"
      />
      <div id="coverTrackInfo" class="cover-info" :inert="trackInfoMinimized">
        <table class="playback-options track-info">
          <tr>
            <th>Title:</th>
            <td>
              <a id="linkTitle" href="#" @click.prevent="togglePlayback">{{ track.title }}</a>
            </td>
          </tr>
          <tr>
            <th>Artist:</th>
            <td>
              <router-link id="linkArtist" :to="trackLinks.artist" target="_blank" rel="noopener noreferrer">{{
                track.artist
              }}</router-link>
            </td>
          </tr>
          <tr>
            <th>Album Artist:</th>
            <td>
              <router-link
                v-if="track.albumartist"
                id="linkAlbumArtist"
                :to="trackLinks.albumartist"
                target="_blank"
                rel="noopener noreferrer"
                >{{ track.albumartist }}</router-link
              >
            </td>
          </tr>
          <tr>
            <th>Album:</th>
            <td>
              <router-link id="linkAlbum" :to="trackLinks.album" target="_blank" rel="noopener noreferrer">{{
                track.album
              }}</router-link>
            </td>
          </tr>
          <tr>
            <th>Genre:</th>
            <td>
              <router-link id="linkGenre" :to="trackLinks.genre" target="_blank" rel="noopener noreferrer">{{
                track.genre
              }}</router-link>
            </td>
          </tr>
          <tr>
            <th>Year:</th>
            <td>
              <router-link id="linkYear" :to="trackLinks.year" target="_blank" rel="noopener noreferrer">{{
                track.year
              }}</router-link>
            </td>
          </tr>
          <tr>
            <th>Country:</th>
            <td>
              <router-link id="linkCountry" :to="trackLinks.country" target="_blank" rel="noopener noreferrer">{{
                track.countryCode
              }}</router-link>
            </td>
          </tr>
          <tr>
            <th>Region:</th>
            <td>
              <router-link id="linkRegion" :to="trackLinks.region" target="_blank" rel="noopener noreferrer">{{
                track.regionCode
              }}</router-link>
            </td>
          </tr>
          <tr>
            <th>City:</th>
            <td>
              <router-link id="linkCity" :to="trackLinks.city" target="_blank" rel="noopener noreferrer">{{
                track.city
              }}</router-link>
            </td>
          </tr>
          <tr>
            <th>Language:</th>
            <td>
              <router-link id="linkLanguage" :to="trackLinks.language" target="_blank" rel="noopener noreferrer">{{
                track.languageCode
              }}</router-link>
            </td>
          </tr>
        </table>
      </div>
      <button
        type="button"
        class="cover-info-bar"
        :aria-label="trackInfoMinimized ? 'Show track info' : 'Hide track info'"
        aria-controls="coverTrackInfo"
        :aria-expanded="!trackInfoMinimized"
        @click="trackInfoMinimized = !trackInfoMinimized"
      >
        <i
          class="bi"
          :class="trackInfoMinimized ? 'bi-chevron-up' : 'bi-chevron-down'"
          aria-hidden="true"
        ></i> {{ trackInfoMinimized ? 'Show track info' : 'Hide track info' }}
      </button>
    </div>
    <div id="playerControls">
      <h1 v-if="localEnabled && hintsMode">Random track, can you name it?</h1>
      <button id="previousBtn" class="button-link" :disabled="!canGoBack" @click="previous">
        <i class="bi bi-rewind-circle-fill"></i> Previous
      </button>
      <template v-if="localEnabled">
        <button id="restartBtn" class="button-link" @click="restart">
          <i class="bi bi-arrow-clockwise"></i> Restart
        </button>
        <button id="playBtn" class="button-link" @click="togglePlayback">
          <template v-if="isPlaying"><i class="bi bi-pause-circle-fill"></i> Pause</template>
          <template v-else><i class="bi bi-play-circle-fill"></i> Play</template>
        </button>
      </template>
      <button id="nextBtn" class="button-link" @click="next">
        <i class="bi bi-fast-forward-circle-fill"></i> Next
      </button>
      <button
        v-for="l in LYRICS_KINDS"
        :key="l.kind"
        :id="`${l.kind}LyricsBtn`"
        class="button-link"
        :class="{ active: shownLyrics === l.kind }"
        :aria-pressed="shownLyrics === l.kind"
        :disabled="lyricsDisabled(l.kind)"
        :title="lyricsTitle(l.kind, l.label)"
        @click="toggleLyrics(l.kind)"
      >
        <i class="bi bi-music-note-list"></i> {{ l.label }}
      </button>
      <br />
      <HintsPanel
        v-if="localEnabled && hintsMode"
        :track="track"
        @reveal="hintsRevealed = true"
      />
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <div
      v-if="shownLyrics && !lyricsDisabled(shownLyrics)"
      :id="`${shownLyrics}Lyrics`"
      class="lyrics"
    >{{ lyrics[shownLyrics] }}</div>
    <div v-show="!hintsMode || hintsRevealed" id="trackList">
      <div v-if="track && trackLinks" class="playback-options-ribbon">
        <router-link
          v-if="localEnabled"
          id="playLocalMediaLink"
          class="playback-option"
          :to="trackLinks.playLocal"
          ><img :src="mp3LogoUrl" class="playback-link-icon" alt="" />Local Media</router-link
        >
        <WebSearchLinks :artist="track.artist" :album="track.album" :title="track.title" />
      </div>
    </div>

    <audio
      v-if="localEnabled"
      ref="audioRef"
      id="audioElem"
      class="full"
      controls
      :src="audioSrc"
      @ended="onEnded"
      @canplaythrough="onCanPlayThrough"
      @play="isPlaying = true"
      @pause="isPlaying = false"
    >
      Your browser does not support the audio element.
    </audio>
  </div>
</template>

<style scoped>
.player-cover {
  position: relative;
  container-type: inline-size;
  width: 822px;
  max-width: 100%;
  margin-inline: auto;
  margin-bottom: 28px;
}

.cover-toggle {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.cover-toggle:focus-visible,
.cover-info-bar:focus-visible {
  outline: 2px solid white;
  outline-offset: 2px;
}

#coverImg {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
}

.cover-info {
  position: absolute;
  bottom: 0;
  left: 0;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  font-size: clamp(12px, 3.9cqi, 1em);
  transform-origin: bottom left;
  transition: transform 250ms ease, opacity 250ms ease, visibility 250ms;
}

.info-minimized .cover-info {
  transform: translateY(28px) scaleY(0);
  opacity: 0;
  visibility: hidden;
}

.cover-info .track-info {
  margin: 0;
  background-color: rgba(13, 17, 23, 0.7);
}

.cover-info .track-info th,
.cover-info .track-info td {
  background-color: transparent;
}

.cover-info-bar {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 0;
  background: #333;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

.cover-info-bar:hover {
  background-color: #7b3f3f;
}

@media (prefers-reduced-motion: reduce) {
  .cover-info {
    transition: none;
  }
}
</style>
