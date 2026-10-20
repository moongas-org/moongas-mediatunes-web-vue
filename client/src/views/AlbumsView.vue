<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import AlbumCover from '../components/AlbumCover.vue'
import QueryFilters from '../components/QueryFilters.vue'
import { useGeoFilterFields } from '../data/geoFilters'
import { configState } from '../configStore'
import { GENRES } from '../data/genres'
import { formatResults } from '../utils/format'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import type { AlbumInfo, FilterField } from '../types'

/** Port of albums.html (album cover grid). */
const route = useRoute()

const albums = ref<AlbumInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const activeCoverIndex = ref(0)
let listRequestId = 0

async function load(): Promise<void> {
  const requestId = ++listRequestId
  loading.value = true
  error.value = null
  albums.value = []
  activeCoverIndex.value = 0
  try {
    const data = await api.albums(route.query)
    if (requestId !== listRequestId) return
    albums.value = data.albums
  } catch (e) {
    if (requestId !== listRequestId) return
    error.value = e instanceof Error ? e.message : String(e)
    albums.value = []
  } finally {
    if (requestId === listRequestId) loading.value = false
  }
}

watch(() => route.query, load, { immediate: true })

const filterFields: FilterField[] = [
  { key: 'artist', label: 'artist', multi: true },
  { key: 'genre', label: 'genre', multi: true, options: GENRES },
  { key: 'explicitCover', label: 'explicit cover', options: ['true', 'false'] },
  { key: 'year', label: 'year', multi: true, type: 'number' },
  { key: 'minYear', label: 'min year', type: 'number' },
  { key: 'maxYear', label: 'max year', type: 'number' },
  ...useGeoFilterFields(),
]

const maxResults = computed(() => configState.config?.maxResultsAlbumCovers ?? 500)

const MIN_COLUMNS = 1
const MAX_COLUMNS = 7
const columns = ref(
  Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.floor(window.innerWidth / 600))),
)

function zoomIn(): void {
  columns.value = Math.max(MIN_COLUMNS, columns.value - 1)
}

function zoomOut(): void {
  columns.value = Math.min(MAX_COLUMNS, columns.value + 1)
}

const showCaptions = ref(true)
</script>

<template>
  <div>
    <QueryFilters :fields="filterFields" />

    <div class="results-info">
      <template v-if="!loading && !error">{{ formatResults(albums.length, maxResults) }}</template>
      <router-link class="button-link" :to="{ path: '/player', query: route.query }"
        ><i class="bi bi-shuffle"></i> play</router-link
      >
      <button
        type="button"
        class="button-link zoom-btn"
        title="Zoom in (fewer covers per row)"
        aria-label="Zoom in"
        :disabled="columns <= MIN_COLUMNS"
        @click="zoomIn"
      >
        <i class="bi bi-zoom-in"></i>
      </button>
      <button
        type="button"
        class="button-link zoom-btn"
        title="Zoom out (more covers per row)"
        aria-label="Zoom out"
        :disabled="columns >= MAX_COLUMNS"
        @click="zoomOut"
      >
        <i class="bi bi-zoom-out"></i>
      </button>
      <label class="caption-toggle">
        <input v-model="showCaptions" type="checkbox" />
        <span class="checkboxtext">captions</span>
      </label>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <LoadingSpinner v-else-if="loading" />
    <div id="trackList" :style="{ '--columns': columns }">
      <AlbumCover
        v-for="(album, index) in albums"
        :key="`${album.artist}|${album.album}|${album.year}`"
        class="album-tile"
        :enabled="index <= activeCoverIndex"
        @settled="activeCoverIndex === index && activeCoverIndex++"
        :cover-path="album.coverPath"
        :query="{ albumartist: album.artist, album: album.album, year: String(album.year) }"
        :alt="`${album.album} album cover`"
        :to="{
          path: '/tracks',
          query: { albumartist: album.artist, album: album.album, year: String(album.year) },
        }"
      >
        <span v-if="showCaptions" class="album-caption">{{ album.artist }} - {{ album.album }} [{{ album.year }}]</span>
      </AlbumCover>
    </div>
  </div>
</template>

<style scoped>
#trackList {
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  padding-bottom: 1em;
}

.album-tile {
  position: relative;
  display: block;
  container-type: inline-size;
}

.zoom-btn {
  padding: 5px 16px;
}

.caption-toggle {
  white-space: nowrap;
  cursor: pointer;
}

.zoom-btn:disabled {
  opacity: 0.4;
  cursor: default;
  background-color: #333;
}

.album-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1.5em 0.5em 0.4em;
  color: #ffffff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
  text-shadow: 0 1px 3px #000;
  /* Shrink with the tile once it's narrow (e.g. many columns on mobile's 720px viewport). */
  font-size: min(0.7em, 9cqi);
}
</style>
