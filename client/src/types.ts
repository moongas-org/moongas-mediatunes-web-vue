/**
 * Shared types mirroring the JSON API payloads.
 */

export interface MediaFile {
  path: string
  size: number
  format: string
  title: string
  artist: string
  albumartist: string
  album: string
  genre: string
  year: number
  duration: number
  countryCode: string
  regionCode: string
  city: string
  languageCode: string
}

export interface AlbumInfo {
  artist: string
  album: string
  year: number
  coverPath: string
  explicitCover: boolean
}

export interface AlbumMetadata {
  id: number
  path: string
  name: string
  year: number
  explicitCover: boolean
}

export interface ArtistCount {
  name: string
  count: number
}

export interface GenreCount {
  genre: string
  count: number
}

export interface ArtistInfo {
  name: string
  countryCode: string
  regionCode: string
  city: string
  languageCode: string
}

export interface GeoCountItem {
  /** User-facing criteria name, e.g. "Country" */
  name: string
  /** User-facing value, e.g. "United States" or "Huntsville (Alabama, United States)" */
  value: string
  /** Filter criteria usable as router query params, e.g. { countryCode: "US" } */
  criteria: Record<string, string>
  count: number
}

export interface WebSearchPlaybackMethod {
  name: string
  searchQueryUrlFormat: string
}

export interface ServerConfig {
  playbackMethodLocalEnabled: boolean
  webSearchPlaybackMethods: WebSearchPlaybackMethod[]
  ageVerification: boolean
  limitBandwidth: boolean
  maxResults: number
  maxResultsAlbumCovers: number
  presentYear: number
}

/** A single random track (player). */
export interface TrackInfo {
  path: string
  coverPath: string
  artist: string
  albumartist: string
  album: string
  title: string
  genre: string
  year: number
  countryCode: string
  regionCode: string
  city: string
  languageCode: string
}

export interface WordCloudWord {
  text: string
  size?: number
}

export type GeoKind = 'countries' | 'regions' | 'cities' | 'languages'

export type WordCloudType = 'genre' | 'artist'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterField {
  /** URL query parameter name. */
  key: string
  label: string
  /** Whether the param may be repeated (?genre=a&genre=b). */
  multi?: boolean
  type?: 'text' | 'number'
  /** When set, the value is chosen from a drop-down instead of typed. */
  options?: readonly (string | FilterOption)[]
}
