import { computed, reactive } from 'vue'
import type { TrackInfo } from './types'

/**
 * Played-track history shared by the player and "name that tune", persisted in
 * a cookie. Tracks are stored as positional arrays (no keys) to fit as many as
 * possible in the ~4 KB cookie limit; the oldest tracks are dropped first.
 */
const COOKIE_NAME = 'playHistory'
const MAX_COOKIE_VALUE_LENGTH = 3800
const FIELDS = [
  'path',
  'coverPath',
  'artist',
  'albumartist',
  'album',
  'title',
  'genre',
  'year',
  'countryCode',
  'regionCode',
  'city',
  'languageCode',
] as const satisfies readonly (keyof TrackInfo)[]

interface PlayHistory {
  tracks: TrackInfo[]
  /** Index of the current track in `tracks` (-1 when empty). */
  position: number
  /** Filter query string the latest random track was loaded with. */
  filters: string
}

interface StoredHistory {
  t: unknown[][]
  p: number
  q: string
}

function decodeTrack(values: unknown[]): TrackInfo | null {
  if (!Array.isArray(values) || typeof values[0] !== 'string') return null
  const track: Record<string, unknown> = {}
  FIELDS.forEach((field, i) => {
    track[field] = field === 'year' ? Number(values[i]) || 0 : String(values[i] ?? '')
  })
  return track as unknown as TrackInfo
}

function read(): PlayHistory {
  const empty: PlayHistory = { tracks: [], position: -1, filters: '' }
  const cookie = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
  if (!cookie) return empty
  try {
    const stored = JSON.parse(decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1))) as StoredHistory
    const tracks = (Array.isArray(stored.t) ? stored.t : [])
      .map(decodeTrack)
      .filter((t): t is TrackInfo => t !== null)
    if (tracks.length === 0) return empty
    const position = Math.min(Math.max(Number(stored.p) || 0, 0), tracks.length - 1)
    return { tracks, position, filters: typeof stored.q === 'string' ? stored.q : '' }
  } catch {
    return empty
  }
}

function encode(h: PlayHistory): string {
  const stored: StoredHistory = {
    t: h.tracks.map((t) => FIELDS.map((f) => t[f] ?? '')),
    p: h.position,
    q: h.filters,
  }
  return encodeURIComponent(JSON.stringify(stored))
}

function save(): void {
  let value = encode(history)
  while (value.length > MAX_COOKIE_VALUE_LENGTH && history.tracks.length > 1) {
    history.tracks.shift()
    history.position = Math.max(history.position - 1, 0)
    value = encode(history)
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const maxAge = value.length > MAX_COOKIE_VALUE_LENGTH ? 0 : 31536000
  document.cookie = `${COOKIE_NAME}=${value}; Path=${import.meta.env.BASE_URL}; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

const history = reactive<PlayHistory>(read())

export const currentHistoryTrack = computed(() => history.tracks[history.position] ?? null)
export const historyFilters = computed(() => history.filters)
export const canGoBack = computed(() => history.position > 0)
export const canGoForward = computed(() => history.position < history.tracks.length - 1)

/** Records a newly loaded random track, discarding any tracks after the current one. */
export function pushHistory(track: TrackInfo, filters: string): void {
  history.tracks.splice(history.position + 1, Infinity, track)
  history.position = history.tracks.length - 1
  history.filters = filters
  save()
}

/** Moves within the history; returns the track there, or null when unavailable. */
export function moveHistory(step: -1 | 1): TrackInfo | null {
  const position = history.position + step
  if (position < 0 || position >= history.tracks.length) return null
  history.position = position
  save()
  return history.tracks[position]
}
