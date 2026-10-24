import type { LocationQuery } from 'vue-router'
import type { TrackInfo } from './types'

const MAX_UNFILTERED_ATTEMPTS = 10

interface TrackSelection {
  track: TrackInfo
  query: LocationQuery
}

/** Returns a different track and the filters that selected it. */
export async function loadNextTrack(
  query: LocationQuery,
  currentPath: string | undefined,
  randomTrack: (query: LocationQuery) => Promise<TrackInfo>,
  isCurrent: () => boolean,
): Promise<TrackSelection | null> {
  const filters: LocationQuery = { ...query }
  delete filters.hints
  for (const key of Object.keys(filters)) {
    const value = filters[key]
    if (value === null || value === '' ||
      (Array.isArray(value) && !value.some((item) => item !== null && item !== ''))) {
      delete filters[key]
    }
  }
  const keys = ['title', 'album', ...Object.keys(filters).filter(
    (key) => key !== 'title' && key !== 'album',
  )].filter((key) => key in filters)
  let unfilteredAttempts = 0

  while (isCurrent()) {
    if (Object.keys(filters).length === 0) unfilteredAttempts++
    const next = await randomTrack({ ...filters })
    if (!isCurrent()) return null
    if (next.path !== currentPath) return { track: next, query: filters }

    const key = keys.shift()
    if (key !== undefined) {
      delete filters[key]
    } else if (unfilteredAttempts >= MAX_UNFILTERED_ATTEMPTS) {
      throw new Error(
        `No different track found after ${MAX_UNFILTERED_ATTEMPTS} unfiltered attempts. Try Next again.`,
      )
    }
  }
  return null
}
