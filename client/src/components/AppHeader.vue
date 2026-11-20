<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { configState } from '../configStore'

const route = useRoute()
const router = useRouter()

interface NavLink {
  label: string
  path: string
  /** Only shown when local playback is enabled. */
  localOnly?: boolean
}

const links: NavLink[] = [
  { label: 'albums', path: '/albums' },
  { label: 'artists', path: '/artists' },
  { label: 'genres', path: '/genres' },
  { label: 'player', path: '/player' },
  {
    label: 'name that tune',
    path: '/name-that-tune',
    localOnly: true,
  },
  { label: 'tracks', path: '/tracks' },
]

const localEnabled = computed(() => configState.config?.playbackMethodLocalEnabled ?? false)

const visibleLinks = computed(() =>
  links.filter((l) => !l.localOnly || localEnabled.value),
)

const selectedView = computed(() =>
  visibleLinks.value.some((link) => link.path === route.path) ? route.path : '',
)

function changeView(event: Event): void {
  const select = event.target
  if (!(select instanceof HTMLSelectElement)) return
  const path = select.value
  select.value = selectedView.value
  if (path === route.path) return
  if (route.path === '/player') {
    window.open(router.resolve(path).href, '_blank', 'noopener,noreferrer')
  } else {
    void router.push(path)
  }
}

/** Year prev/next nav (header_impl_years.html); suppressed on routes with meta.noYears. */
const year = computed<number | null>(() => {
  if (route.meta.noYears === true) return null
  const raw = route.query.year
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) && n > 0 ? n : null
})

function yearQuery(y: number): LocationQueryRaw {
  return { ...route.query, year: String(y) }
}
</script>

<template>
  <header>
    <div id="header">
      <label class="view-navigation">
        view
        <select :value="selectedView" @change="changeView">
          <option value="" disabled>Select a view</option>
          <option v-for="link in visibleLinks" :key="link.path" :value="link.path">
            {{ link.label }}
          </option>
        </select>
      </label>
      <span id="header-filter-controls"></span>
    </div>
    <nav v-if="year !== null" class="year-navigation" aria-label="Year navigation">
      <router-link :to="{ path: route.path, query: yearQuery(year - 1) }">{{ year - 1 }}</router-link>
      <b>
        <router-link :to="{ path: route.path, query: yearQuery(year) }">{{ year }}</router-link>
      </b>
      <router-link :to="{ path: route.path, query: yearQuery(year + 1) }">{{ year + 1 }}</router-link>
    </nav>
  </header>
</template>

<style scoped>
#header {
  --header-control-height: 1.3em;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

#header-filter-controls {
  display: contents;
}

.view-navigation {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  padding: 4px;
}

.view-navigation select {
  box-sizing: border-box;
  block-size: var(--header-control-height);
}

.year-navigation {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1em;
  padding: 4px;
}
</style>
