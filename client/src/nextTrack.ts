import type { LocationQuery } from 'vue-router'
import type { MediaFile, TrackInfo } from './types'

const MAX_UNFILTERED_ATTEMPTS = 10

interface TrackSelection {
  track: TrackInfo
  query: LocationQuery
}

/** Resolves the selected track's YAML path to its database ID. */
export async function loadTrackId(
  track: TrackInfo,
  tracks: (query: LocationQuery) => Promise<{ files: Pick<MediaFile, 'id' | 'path'>[] }>,
  isCurrent: () => boolean,
): Promise<number | null> {
  if (!isCurrent()) return null
  const result = await tracks({ artist: track.artist, album: track.album, title: track.title })
  if (!isCurrent()) return null
  const selected = result.files.find((file) => file.path === track.path)
  if (!selected || !Number.isInteger(selected.id)) {
    throw new Error(`Unable to find the track ID for ${track.path}.`)
  }
  return selected.id
}

/** Resolves the selected track's YAML path to its first playable media file. */
export async function loadTrackMediaPath(
  track: TrackInfo,
  tracks: (query: LocationQuery) => Promise<{ files: Pick<MediaFile, 'id' | 'path'>[] }>,
  mediafiles: (query: LocationQuery) => Promise<{ mediafiles: Pick<MediaFile, 'path'>[] }>,
  isCurrent: () => boolean,
): Promise<string | null> {
  const trackId = await loadTrackId(track, tracks, isCurrent)
  if (trackId === null || !isCurrent()) return null
  const media = await mediafiles({ trackid: String(trackId) })
  if (!isCurrent()) return null
  const first = media.mediafiles[0]
  if (!first?.path) {
    throw new Error(`No media file found for track ID ${trackId}.`)
  }
  return first.path
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
