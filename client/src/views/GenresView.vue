<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { configState } from '../configStore'
import { formatResults } from '../utils/format'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import { queryScalar } from '../utils/queryParams'
import type { GenreCount } from '../types'

/** Port of genres.html (genre counts table). */
const route = useRoute()

const genres = ref<GenreCount[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const sort = computed(() => queryScalar(route.query, 'sort') ?? '')

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const data = await api.genres(sort.value || undefined)
    genres.value = data.genres
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    genres.value = []
  } finally {
    loading.value = false
  }
}

watch(() => route.query, load, { immediate: true })

const maxResults = computed(() => configState.config?.maxResults ?? 50000)
</script>

<template>
  <div>
      <table class="w-100">
        <tr>
          <td colspan="2" style="text-align: right"><router-link to="/genres-cloud">☁</router-link></td>
        </tr>
      </table>
    <div v-if="!loading && !error" class="results-info">{{ formatResults(genres.length, maxResults) }}:</div>
    <div v-if="error" class="error">{{ error }}</div>
    <LoadingSpinner v-else-if="loading" />
    <div v-else id="trackList">
      <table class="w-100">
        <thead>
          <tr>
            <th><router-link :to="{ path: '/genres', query: { sort: 'count' } }">Count</router-link></th>
            <th><router-link :to="{ path: '/genres', query: { sort: 'name' } }">Genre</router-link></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in genres" :key="g.genre">
            <td>{{ g.count }}</td>
            <td>
              <router-link :to="{ path: '/genre', query: { genre: g.genre } }">{{
                g.genre
              }}</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
