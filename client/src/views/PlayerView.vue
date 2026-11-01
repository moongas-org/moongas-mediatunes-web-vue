<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, buildSearchParams, getfileUrl } from '../api'
import AlbumCover from '../components/AlbumCover.vue'
import HowlerPlayer from '../components/HowlerPlayer.vue'
import { configState } from '../configStore'
import { GENRES } from '../data/genres'
import HintsPanel from '../components/HintsPanel.vue'
import QueryFilters from '../components/QueryFilters.vue'
import { useGeoFilterFields } from '../data/geoFilters'
import WebSearchLinks from '../components/WebSearchLinks.vue'
import mp3LogoUrl from '../assets/svg/mp3_logo.svg'
import { loadNextTrack, loadTrackId } from '../nextTrack'
import {
  canGoBack,
  currentHistoryTrack,
  historyFilters,
  moveHistory,
  pushHistory,
} from '../playHistory'
import type { FilterField, TrackInfo, TrackMediaFile, TrackStreaming } from '../types'

/**
 * Port of player.html, including its inline jQuery script.
 *
 * Behavior: shows a random track matching the query-string filters; when local
 * playback is enabled, streams the file via /getfile and auto-advances to the
 * next random track when playback ends. Played tracks are kept in a cookie
 * history (see playHistory.ts) for the Previous/Next buttons, and the player
 * resumes the most recent track. Track info collapses after 10 seconds without
 * hover or keyboard focus; explicitly reopening it keeps it visible until the
 * next track. With ?hints=1 ("name that tune"),
 * track details and cover are hidden until the user reveals them.
 */
const props = defineProps<{ hints?: boolean }>()

const route = useRoute()
const router = useRouter()

const track = ref<TrackInfo | null>(null)
const mediaPath = ref<string | null>(null)
const mediaFiles = ref<TrackMediaFile[]>([])
const trackStreaming = ref<TrackStreaming[]>([])
const mediaError = ref<string | null>(null)
const streamingError = ref<string | null>(null)
const sourcesLoading = ref(false)
const sourceRows = computed(() => [
  ...mediaFiles.value.map((item) => ({ kind: 'mediafile', item })),
  ...trackStreaming.value.map((item) => ({ kind: 'trackstreaming', item })),
])
const error = ref<string | null>(null)
/** Whether a newly selected track should start playing automatically. */
const autoplayPending = ref(false)
/** "name that tune": details/cover stay hidden until Show Details is clicked. */
const hintsRevealed = ref(false)
const trackInfoMinimized = ref(false)
const trackInfoPinned = ref(false)
const trackInfoHovered = ref(false)
const trackInfoBarHovered = ref(false)
const trackInfoFocused = ref(false)
let trackInfoHideTimer: ReturnType<typeof setTimeout> | undefined

function clearTrackInfoHideTimer(): void {
  clearTimeout(trackInfoHideTimer)
  trackInfoHideTimer = undefined
}

function updateTrackInfoFocus(event: FocusEvent): void {
  const target = event.type === 'focusin' ? event.target : event.relatedTarget
  trackInfoFocused.value = target instanceof Element
    && event.currentTarget instanceof Element
    && event.currentTarget.contains(target)
    && target.closest('.cover-info, .cover-info-bar') !== null
}

function toggleTrackInfo(): void {
  if (trackInfoMinimized.value) trackInfoPinned.value = true
  trackInfoMinimized.value = !trackInfoMinimized.value
}

onUnmounted(clearTrackInfoHideTimer)

const playerRef = ref<InstanceType<typeof HowlerPlayer> | null>(null)

type LyricsKind = 'txt' | 'lrc'
type YamlKind = 'track' | 'album' | 'artist'
type FileKind = LyricsKind | YamlKind
/** Lyrics buttons: plain-text (.txt) and synced (.lrc) lyrics files. */
const LYRICS_KINDS: { kind: LyricsKind; ext: '.txt' | '.lrc'; label: string }[] = [
  { kind: 'txt', ext: '.txt', label: 'Lyrics' },
  { kind: 'lrc', ext: '.lrc', label: 'LRC' },
]
const YAML_KINDS: { kind: YamlKind; label: string }[] = [
  { kind: 'track', label: 'Track YAML' },
  { kind: 'album', label: 'Album YAML' },
  { kind: 'artist', label: 'Artist YAML' },
]
const fileText = ref<Record<FileKind, string | null>>({
  txt: null, lrc: null, track: null, album: null, artist: null,
})
const yamlLoading = ref(false)
const yamlErrors = ref<Partial<Record<YamlKind, string>>>({})
const lyricsLoading = ref(false)
const shownFile = ref<FileKind | null>(null)
/** Incremented per track so stale lyrics responses are ignored. */
let lyricsRequestId = 0

const localEnabled = computed(() => configState.config?.playbackMethodLocalEnabled ?? false)
const hintsMode = computed(() => props.hints || route.query.hints === '1')

watch(
  [
    track,
    () => !hintsMode.value || hintsRevealed.value,
    trackInfoMinimized,
    trackInfoPinned,
    trackInfoHovered,
    trackInfoBarHovered,
    trackInfoFocused,
  ],
  ([selected, visible, minimized, pinned, hovered, barHovered, focused]) => {
    clearTrackInfoHideTimer()
    if (!visible) {
      trackInfoHovered.value = false
      trackInfoBarHovered.value = false
      trackInfoFocused.value = false
    }
    if (!selected || !visible || minimized || pinned || hovered || barHovered || focused) return
    trackInfoHideTimer = setTimeout(() => {
      trackInfoHideTimer = undefined
      trackInfoMinimized.value = true
    }, 10_000)
  },
)

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
/** URL replacement for a selected track must not trigger another selection. */
let selectedTrackUrl: string | null = null
onUnmounted(() => { trackRequestId++ })

function showTrack(next: TrackInfo, autoplay: boolean): void {
  const samePath = next.path === track.value?.path
  error.value = null
  hintsRevealed.value = false
  trackInfoPinned.value = false
  trackInfoMinimized.value = false
  track.value = next
  // An unchanged source does not trigger the player's source watcher.
  autoplayPending.value = autoplay && !samePath
  if (autoplay && samePath) restart()
}

async function loadRandomTrack(autoplay: boolean): Promise<void> {
  const requestId = ++trackRequestId
  error.value = null
  try {
    const selection = await loadNextTrack(
      route.query,
      track.value?.path,
      api.randomTrack,
      () => requestId === trackRequestId,
    )
    if (!selection || requestId !== trackRequestId) return
    const { track: next, query } = selection
    pushHistory(next, buildSearchParams(query).toString())
    showTrack(next, autoplay)
    if (route.query.hints !== undefined) query.hints = route.query.hints
    const location = { path: route.path, query, hash: route.hash }
    const url = router.resolve(location).fullPath
    if (url !== route.fullPath) {
      selectedTrackUrl = url
      try {
        const failure = await router.replace(location)
        if (failure) throw failure
      } finally {
        if (selectedTrackUrl === url) selectedTrackUrl = null
      }
    }
  } catch (e) {
    if (requestId !== trackRequestId) return
    error.value = `Failed to load track(s). ${e instanceof Error ? e.message : String(e)}`
  }
}

/** Shows the previous/next track from the play history; false if there is none. */
function showHistoryTrack(step: -1 | 1, autoplay: boolean): boolean {
  let next = moveHistory(step)
  while (next && next.path === track.value?.path) next = moveHistory(step)
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
    if (route.fullPath === selectedTrackUrl) {
      selectedTrackUrl = null
      return
    }
    selectedTrackUrl = null
    trackRequestId++
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
  mediaPath.value && localEnabled.value ? getfileUrl(mediaPath.value) : undefined,
)

watch(
  () => track.value,
  async (selected, _previous, onCleanup) => {
    let active = true
    onCleanup(() => { active = false })
    mediaPath.value = null
    mediaFiles.value = []
    trackStreaming.value = []
    mediaError.value = null
    streamingError.value = null
    sourcesLoading.value = Boolean(selected)
    if (!selected) return
    try {
      const trackId = await loadTrackId(selected, api.tracks, () => active)
      if (trackId === null || !active) return
      const query = { trackid: String(trackId) }
      await Promise.all([
        (async () => {
          try {
            const result = await api.mediafiles(query)
            if (!active) return
            mediaFiles.value = result.mediafiles
            const first = result.mediafiles[0]
            if (!first?.path) throw new Error(`No media file found for track ID ${trackId}.`)
            mediaPath.value = first.path
          } catch (e) {
            if (!active) return
            mediaError.value = `Failed to load media file. ${e instanceof Error ? e.message : String(e)}`
          }
        })(),
        (async () => {
          try {
            const result = await api.trackstreaming(query)
            if (active) trackStreaming.value = result.trackstreaming
          } catch (e) {
            if (!active) return
            streamingError.value = `Failed to load track streaming. ${e instanceof Error ? e.message : String(e)}`
          }
        })(),
      ])
    } catch (e) {
      if (!active) return
      mediaError.value = `Failed to load track sources. ${e instanceof Error ? e.message : String(e)}`
    } finally {
      if (active) sourcesLoading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => track.value?.path,
  async (path, _previous, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => { controller.abort() })
    fileText.value.track = null
    fileText.value.album = null
    fileText.value.artist = null
    yamlErrors.value = {}
    shownFile.value = null
    yamlLoading.value = Boolean(path)
    if (!path) return
    const albumDirectory = path.slice(0, path.lastIndexOf('/') + 1)
    const artistDirectory = albumDirectory.replace(/[^/]+\/$/, '')
    const paths: Record<YamlKind, string> = {
      track: path,
      album: `${albumDirectory}album.yml`,
      artist: `${artistDirectory}artist.yml`,
    }
    await Promise.all(YAML_KINDS.map(async ({ kind, label }) => {
      try {
        const text = await api.fileText(paths[kind], controller.signal)
        if (!controller.signal.aborted) fileText.value[kind] = text
      } catch (e) {
        if (controller.signal.aborted) return
        const message = `Failed to load ${label}. ${e instanceof Error ? e.message : String(e)}`
        yamlErrors.value[kind] = message
        console.error(message)
      }
    }))
    if (!controller.signal.aborted) yamlLoading.value = false
  },
  { immediate: true },
)

/**
 * Lyrics live alongside the media file with ".txt" / ".lrc" extensions.
 * They're fetched regardless of whether local playback is enabled.
 */
watch(
  () => mediaPath.value,
  async (path) => {
    const requestId = ++lyricsRequestId
    fileText.value.txt = null
    fileText.value.lrc = null
    if (shownFile.value === 'txt' || shownFile.value === 'lrc') shownFile.value = null
    if (!path) {
      lyricsLoading.value = false
      return
    }
    lyricsLoading.value = true
    const results = await Promise.all(
      LYRICS_KINDS.map(({ ext }) => api.lyrics(path, ext).catch(() => null)),
    )
    if (requestId !== lyricsRequestId) return
    fileText.value.txt = results[0]
    fileText.value.lrc = results[1]
    lyricsLoading.value = false
  },
  { immediate: true },
)

/** Text files would give the answer away in "name that tune" mode. */
function fileDisabled(kind: FileKind): boolean {
  return fileText.value[kind] === null || (hintsMode.value && !hintsRevealed.value)
}

function fileTitle(kind: FileKind, label: string): string {
  const isLyrics = kind === 'txt' || kind === 'lrc'
  if (isLyrics ? lyricsLoading.value : yamlLoading.value) return `Loading ${label}…`
  if (!isLyrics && yamlErrors.value[kind]) return yamlErrors.value[kind]
  if (fileText.value[kind] === null) return `${label} not available`
  return `Show/hide ${label}`
}

function toggleFile(kind: FileKind): void {
  if (fileDisabled(kind)) return
  shownFile.value = shownFile.value === kind ? null : kind
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
  playerRef.value?.togglePlayback()
}

function restart(): void {
  playerRef.value?.restart()
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
      @focusin="updateTrackInfoFocus"
      @focusout="updateTrackInfoFocus"
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
      <div
        id="coverTrackInfo"
        class="cover-info"
        :inert="trackInfoMinimized"
        @mouseenter="trackInfoHovered = true"
        @mouseleave="trackInfoHovered = false"
      >
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
        @mouseenter="trackInfoBarHovered = true"
        @mouseleave="trackInfoBarHovered = false"
        @click="toggleTrackInfo"
      >
        <i
          class="bi"
          :class="trackInfoMinimized ? 'bi-chevron-up' : 'bi-chevron-down'"
          aria-hidden="true"
        ></i>
      </button>
    </div>
    <div id="playerControls">
      <h1 v-if="localEnabled && hintsMode">Random track, can you name it?</h1>
      <button id="previousBtn" class="button-link" aria-label="Previous" title="Previous" :disabled="!canGoBack" @click="previous">
        <i class="bi bi-rewind-circle-fill" aria-hidden="true"></i>
      </button>
      <template v-if="localEnabled">
        <button
          id="playBtn"
          class="button-link"
          :aria-label="playerRef?.isPlaying ? 'Pause' : 'Play'"
          :title="playerRef?.isPlaying ? 'Pause' : 'Play'"
          :disabled="!audioSrc || !playerRef || playerRef.loading"
          @click="togglePlayback"
        >
          <i
            :class="playerRef?.isPlaying ? 'bi bi-pause-circle-fill' : 'bi bi-play-circle-fill'"
            aria-hidden="true"
          ></i>
        </button>
      </template>
      <button id="nextBtn" class="button-link" aria-label="Next" title="Next" @click="next">
        <i class="bi bi-fast-forward-circle-fill" aria-hidden="true"></i>
      </button>
      <HowlerPlayer
        v-if="localEnabled"
        ref="playerRef"
        :src="audioSrc"
        :autoplay="autoplayPending"
        :title="!hintsMode || hintsRevealed ? track?.title : undefined"
        :artist="!hintsMode || hintsRevealed ? track?.artist : undefined"
        :album="!hintsMode || hintsRevealed ? track?.album : undefined"
        @ended="onEnded"
        @next="next"
        @previous="previous"
      />
      <button
        v-for="l in LYRICS_KINDS"
        :key="l.kind"
        :id="`${l.kind}LyricsBtn`"
        class="button-link"
        :class="{ active: shownFile === l.kind }"
        :aria-pressed="shownFile === l.kind"
        :disabled="fileDisabled(l.kind)"
        :title="fileTitle(l.kind, l.label)"
        @click="toggleFile(l.kind)"
      >
        <i class="bi bi-music-note-list"></i> {{ l.label }}
      </button>
      <br />
      <button
        v-for="y in YAML_KINDS"
        :key="y.kind"
        :id="`${y.kind}YamlBtn`"
        class="button-link"
        :class="{ active: shownFile === y.kind }"
        :aria-pressed="shownFile === y.kind"
        :aria-controls="`${y.kind}Yaml`"
        :disabled="fileDisabled(y.kind)"
        :title="fileTitle(y.kind, y.label)"
        @click="toggleFile(y.kind)"
      >
        <i class="bi bi-file-earmark-text"></i> {{ y.label }}
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
      v-if="shownFile && !fileDisabled(shownFile)"
      :id="shownFile === 'txt' || shownFile === 'lrc' ? `${shownFile}Lyrics` : `${shownFile}Yaml`"
      class="lyrics"
      :class="{ yaml: shownFile === 'track' || shownFile === 'album' || shownFile === 'artist' }"
    >{{ fileText[shownFile] }}</div>
    <div v-show="!hintsMode || hintsRevealed" id="trackList">
      <div v-if="track" id="trackSources" :aria-busy="sourcesLoading">
        <div v-if="mediaError" class="error" role="alert">{{ mediaError }}</div>
        <div v-if="streamingError" class="error" role="alert">{{ streamingError }}</div>
        <div v-if="sourcesLoading" role="status">Loading track sources...</div>
        <div v-if="sourceRows.length" class="track-sources-table">
          <table class="track-sources" aria-label="Track media files and streaming items">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in sourceRows" :key="`${row.kind}-${index}`">
                <th scope="row">{{ row.kind }}</th>
                <td>
                  <table class="source-properties" :aria-label="`${row.kind} ${index + 1} properties`">
                    <tbody>
                      <tr v-for="(value, key) in row.item" :key="key">
                        <th scope="row">{{ key }}:</th>
                        <td>{{ value }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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

  </div>
</template>

<style scoped>
.track-sources-table {
  max-width: 100%;
  margin-block: 16px;
}

.track-sources,
.source-properties {
  table-layout: fixed;
}

.track-sources-table th,
.track-sources-table td {
  width: auto;
  overflow-wrap: anywhere;
  text-align: left;
  vertical-align: top;
}

.track-sources {
  border-collapse: separate;
  border-spacing: 0 4px;
}

.track-sources > thead > tr > th,
.track-sources > tbody > tr > th,
.track-sources > tbody > tr > td {
  border: 1px solid #666;
  padding: 8px;
  text-align: center;
  vertical-align: middle;
}

.track-sources > thead > tr > th + th {
  border-left: 4px solid transparent;
  background-clip: padding-box;
  box-shadow: inset 1px 0 #666;
}

.track-sources > tbody > tr > td {
  border-left: 0;
}

.track-sources > thead > tr > th:first-child,
.track-sources > tbody > tr > th {
  width: 24%;
}

.source-properties th {
  width: 35%;
  text-align: right;
}

.source-properties td {
  font-weight: 600;
}

#playBtn .bi {
  font-size: 2em;
}

.yaml {
  text-align: left;
  font-family: monospace;
}

.player-cover {
  position: relative;
  container-type: inline-size;
  width: 822px;
  max-width: 100%;
  margin-inline: auto;
  margin-bottom: 54px;
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
  transition: transform 600ms ease, opacity 600ms ease, visibility 600ms;
}

.info-minimized .cover-info {
  transform: translateY(42px) scaleY(0);
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

.cover-info .track-info td a {
  font-weight: 600;
}

.cover-info-bar {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: 42px;
  padding: 0 8px;
  border: 0;
  background: #333;
  color: white;
  font-size: 24px;
  cursor: pointer;
}

.cover-info-bar:hover {
  background-color: #7b3f3f;
}

@media (prefers-reduced-motion: reduce) {
  .cover-info {
    transition: opacity 600ms ease, visibility 600ms;
  }

  .info-minimized .cover-info {
    transform: none;
  }
}
</style>
