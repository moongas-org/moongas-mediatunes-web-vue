import { reactive } from 'vue'
import { api } from '../api'
import type { FilterField, FilterOption, GeoKind } from '../types'
import { COUNTRIES } from './countries'

const geoOptions = reactive({
  regionCode: [] as FilterOption[],
  city: [] as FilterOption[],
  languageCode: [] as FilterOption[],
})

type GeoKey = keyof typeof geoOptions

async function loadKind(kind: GeoKind, key: GeoKey): Promise<void> {
  const { items } = await api.artistGeo(kind)
  const byValue = new Map<string, string[]>()
  for (const item of items) {
    const value = item.criteria[key]
    if (!value) continue
    byValue.set(value, [...(byValue.get(value) ?? []), item.value])
  }
  // A city name shared by several places filters all of them, so label it by name alone.
  const options = [...byValue].map(([value, labels]) => ({
    value,
    label: labels.length === 1 ? labels[0] : value,
  }))
  options.sort((a, b) => a.label.localeCompare(b.label))
  geoOptions[key].splice(0, Infinity, ...options)
}

let loadPromise: Promise<void> | null = null

/** Display name for a country code (falls back to the code). */
export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.value === code)?.label ?? code
}

/** Display name for a region code once loaded from the backend (falls back to the code). */
export function regionName(code: string): string {
  ensureLoaded()
  return geoOptions.regionCode.find((r) => r.value === code)?.label ?? code
}

function ensureLoaded(): void {
  loadPromise ??= Promise.all([
    loadKind('regions', 'regionCode'),
    loadKind('cities', 'city'),
    loadKind('languages', 'languageCode'),
  ])
    .then(() => undefined)
    .catch((e: unknown) => {
      console.error('Failed to load geo filter options', e)
      loadPromise = null
    })
}

/** Country/region/city/language drop-down filter fields; all but country load from the backend on first use. */
export function useGeoFilterFields(): FilterField[] {
  ensureLoaded()
  return [
    { key: 'countryCode', label: 'country', multi: true, options: COUNTRIES },
    { key: 'regionCode', label: 'region', multi: true, options: geoOptions.regionCode },
    { key: 'city', label: 'city', multi: true, options: geoOptions.city },
    { key: 'languageCode', label: 'language', multi: true, options: geoOptions.languageCode },
  ]
}
