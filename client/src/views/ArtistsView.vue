<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, type LocationQueryRaw } from 'vue-router'
import { api } from '../api'
import QueryFilters from '../components/QueryFilters.vue'
import { useGeoFilterFields } from '../data/geoFilters'
import { configState } from '../configStore'
import { GENRES } from '../data/genres'
import { formatResults } from '../utils/format'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import { queryList, queryScalar } from '../utils/queryParams'
import type { ArtistCount, FilterField } from '../types'

/** Port of artists.html (artist counts table). */
const route = useRoute()

const artists = ref<ArtistCount[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const data = await api.artists(route.query)
    artists.value = data.artists
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    artists.value = []
  } finally {
    loading.value = false
  }
}

watch(() => route.query, load, { immediate: true })

const maxResults = computed(() => configState.config?.maxResults ?? 50000)

// Matches the params preserved by sortQuery().
const filterFields: FilterField[] = [
  { key: 'artist', label: 'artist', multi: true },
  { key: 'albumartist', label: 'album artist' },
  { key: 'genre', label: 'genre', multi: true, options: GENRES },
  { key: 'year', label: 'year', multi: true, type: 'number' },
  { key: 'minYear', label: 'min year', type: 'number' },
  { key: 'maxYear', label: 'max year', type: 'number' },
  ...useGeoFilterFields(),
]

/**
 * Sort header links preserve the filter params
 * (mirrors the url_for calls in artists.html).
 */
function sortQuery(sort: string): LocationQueryRaw {
  return {
    artist: queryList(route.query, 'artist'),
    albumartist: queryScalar(route.query, 'albumartist') ?? undefined,
    genre: queryList(route.query, 'genre'),
    year: queryList(route.query, 'year'),
    minYear: queryScalar(route.query, 'minYear') ?? undefined,
    maxYear: queryScalar(route.query, 'maxYear') ?? undefined,
    countryCode: queryList(route.query, 'countryCode'),
    regionCode: queryList(route.query, 'regionCode'),
    city: queryList(route.query, 'city'),
    languageCode: queryList(route.query, 'languageCode'),
    sort,
  }
}
</script>

<template>
  <div>
    <QueryFilters :fields="filterFields" />
    <div class="results-info">
      <template v-if="!loading && !error">{{ formatResults(artists.length, maxResults) }}</template>
      <router-link class="button-link" :to="{ path: '/player', query: route.query }"
        ><i class="bi bi-shuffle"></i> play</router-link
      >
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <LoadingSpinner v-else-if="loading" />
    <div v-else id="trackList">
      <table class="w-100">
        <thead>
          <tr>
            <th>
              <router-link :to="{ path: '/artists', query: sortQuery('count') }">Count</router-link>
            </th>
            <th>
              <router-link :to="{ path: '/artists', query: sortQuery('name') }">Artist</router-link>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="artist in artists" :key="artist.name">
            <td>{{ artist.count }}</td>
            <td>
              <router-link :to="{ path: '/artist', query: { artist: artist.name } }">{{
                artist.name
              }}</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
