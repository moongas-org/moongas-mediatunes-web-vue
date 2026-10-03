<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import type { ArtistInfo } from '../types'

/** Port of artist.html (single artist detail page). */
const route = useRoute()

const artist = ref<ArtistInfo | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const data = await api.artist(route.query)
    artist.value = data.artist
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    artist.value = null
  } finally {
    loading.value = false
  }
}

watch(() => route.query, load, { immediate: true })
</script>

<template>
  <div>
    <div v-if="error" class="error">{{ error }}</div>
    <LoadingSpinner v-else-if="loading" />
    <div v-else-if="artist" class="artist">
      <table class="artist">
        <tr>
          <th>{{ artist.name }}</th>
        </tr>
        <tr>
          <td>
            <router-link class="button-link" :to="{ path: '/albums', query: { albumartist: artist.name } }"
              >albums</router-link
            >
          </td>
        </tr>
        <tr>
          <td>
            <router-link class="button-link" :to="{ path: '/tracks', query: { albumartist: artist.name } }"
              >tracks</router-link
            >
          </td>
        </tr>
        <tr>
          <td>
            <router-link class="button-link" :to="{ path: '/player', query: { albumartist: artist.name } }"
              ><i class="bi bi-shuffle"></i> play</router-link
            >
          </td>
        </tr>
      </table>
      <table class="artist-info track-info">
        <tr>
          <th>Country:</th>
          <td>
            <router-link :to="{ path: '/artists', query: { countryCode: artist.countryCode } }">{{
              artist.countryCode
            }}</router-link>
          </td>
        </tr>
        <tr>
          <th>Region:</th>
          <td>
            <router-link :to="{ path: '/artists', query: { regionCode: artist.regionCode } }">{{
              artist.regionCode
            }}</router-link>
          </td>
        </tr>
        <tr>
          <th>City:</th>
          <td>
            <router-link :to="{ path: '/artists', query: { city: artist.city } }">{{
              artist.city
            }}</router-link>
          </td>
        </tr>
        <tr>
          <th>Language:</th>
          <td>
            <router-link :to="{ path: '/artists', query: { languageCode: artist.languageCode } }">{{
              artist.languageCode
            }}</router-link>
          </td>
        </tr>
      </table>
    </div>
  </div>
</template>
