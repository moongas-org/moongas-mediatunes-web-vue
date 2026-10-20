import type { LocationQuery } from 'vue-router'
import type {
  AlbumInfo,
  AlbumMetadata,
  ArtistCount,
  ArtistInfo,
  GeoCountItem,
  GeoKind,
  GenreCount,
  MediaFile,
  ServerConfig,
  TrackInfo,
  WordCloudWord,
} from './types'

/**
 * Serialize vue-router query params into URLSearchParams.
 * Multi-value params are repeated (?genre=a&genre=b), as the backend
 * API expects.
 */
export function buildSearchParams(query: LocationQuery): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== null && v !== undefined && v !== '') params.append(key, v)
      }
    } else {
      params.append(key, value)
    }
  }
  return params
}

/**
 * Base path the SPA is served under, derived from Vite's `base`
 * (e.g. "/mediatunes/"). Used to prefix same-origin API and media URLs so
 * the client works identically whether served from the root (dev) or from a
 * sub-path (prod). Always ends with a trailing slash; never a lone "/".
 */
const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

/** URL for a JSON API path, prefixed with the base path. */
function apiUrl(path: string): string {
  return `${BASE}api${path.startsWith('/') ? path : `/${path}`}`
}

async function fetchJson<T>(path: string, query?: LocationQuery, signal?: AbortSignal): Promise<T> {
  const qs = query ? buildSearchParams(query).toString() : ''
  const url = qs ? `${apiUrl(path)}?${qs}` : apiUrl(path)
  const resp = await fetch(url, { signal })
  if (!resp.ok) {
    throw new Error(`GET ${url} failed: ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as T
}

/** URL for the getfile/<path> media-file endpoint, prefixed with the base path. */
export function getfileUrl(path: string): string {
  return `${BASE}getfile${path.startsWith('/') ? path : `/${path}`}`
}

/** Path of a sidecar file for a media file: same name with the given extension (e.g. ".txt"). */
export function sidecarPath(mediaPath: string, ext: string): string {
  return mediaPath.replace(/\.[^./]+$/, '') + ext
}

/** Fetch a text sidecar file (e.g. ".txt"/".lrc" lyrics) for a media file via getfile; throws if unavailable. */
async function fetchSidecarText(mediaPath: string, ext: string): Promise<string> {
  const url = getfileUrl(sidecarPath(mediaPath, ext))
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`GET ${url} failed: ${resp.status} ${resp.statusText}`)
  }
  if ((resp.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`GET ${url} returned HTML, not text`)
  }
  return await resp.text()
}

export const api = {
  config: () => fetchJson<ServerConfig>('/config'),

  albums: (query: LocationQuery) =>
    fetchJson<{ albums: AlbumInfo[] }>('/albums', query),

  album: (query: LocationQuery, signal?: AbortSignal) =>
    fetchJson<{ album: AlbumMetadata }>('/album', query, signal),

  tracks: (query: LocationQuery) =>
    fetchJson<{ files: MediaFile[]; coverPath: string }>('/tracks', query),

  artists: (query: LocationQuery) =>
    fetchJson<{ artists: ArtistCount[] }>('/artists', query),

  artist: (query: LocationQuery) => fetchJson<{ artist: ArtistInfo }>('/artist', query),

  genres: (sort?: string) =>
    fetchJson<{ genres: GenreCount[] }>('/genres', sort ? { sort } : undefined),

  artistGeo: (kind: GeoKind) => fetchJson<{ items: GeoCountItem[] }>(`/artist-geo/${kind}`),

  wordCloudGenres: () => fetchJson<{ words: WordCloudWord[] }>('/wordcloud/genres'),

  wordCloudArtists: (query: LocationQuery) =>
    fetchJson<{ words: WordCloudWord[] }>('/wordcloud/artists', query),

  randomTrack: (query: LocationQuery) => fetchJson<TrackInfo>('/random-track', query),

  lyrics: (mediaPath: string, ext: '.txt' | '.lrc') => fetchSidecarText(mediaPath, ext),
}
