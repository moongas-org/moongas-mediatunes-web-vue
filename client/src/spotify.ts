import type { TrackStreaming } from './types'

export function selectSpotifyTrack(items: readonly TrackStreaming[]): { trackId: string | null; error: string | null } {
  const first = items.find((item) => (item.streaming_service ?? item.streamingservice) === 'spotify')
  if (!first) return { trackId: null, error: null }
  const id = first.streaming_track_id ?? first.streamingtrackid
  if (typeof id !== 'string' || !/^[a-zA-Z0-9]{22}$/.test(id)) {
    return { trackId: null, error: 'The first Spotify streaming entry has an invalid streaming_track_id.' }
  }
  return { trackId: id, error: null }
}

export interface SpotifyState {
  paused: boolean
  position: number
  duration: number
  track_window: { current_track: { uri: string } }
}

interface SpotifyEvents {
  ready: { device_id: string }
  not_ready: { device_id: string }
  player_state_changed: SpotifyState | null
  initialization_error: { message: string }
  authentication_error: { message: string }
  account_error: { message: string }
  playback_error: { message: string }
}

export interface SpotifyPlayer {
  addListener<K extends keyof SpotifyEvents>(event: K, callback: (value: SpotifyEvents[K]) => void): boolean
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  seek(position: number): Promise<void>
  setVolume(volume: number): Promise<void>
  getCurrentState(): Promise<SpotifyState | null>
}

interface SpotifySDK {
  Player: new (options: {
    name: string
    volume: number
    getOAuthToken: (callback: (token: string) => void) => void
  }) => SpotifyPlayer
}

declare global {
  interface Window {
    Spotify?: SpotifySDK
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

let sdkPromise: Promise<SpotifySDK> | undefined

export function loadSpotifySDK(): Promise<SpotifySDK> {
  if (window.Spotify) return Promise.resolve(window.Spotify)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<SpotifySDK>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    const timeout = setTimeout(() => fail(), 15000)
    function fail(): void {
      clearTimeout(timeout)
      script.remove()
      window.onSpotifyWebPlaybackSDKReady = undefined
      reject(new Error('Unable to load the Spotify SDK. Check your connection and content blockers, then retry.'))
    }
    script.onerror = fail
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (!window.Spotify) return fail()
      clearTimeout(timeout)
      resolve(window.Spotify)
    }
    document.head.append(script)
  }).catch((error: unknown) => {
    sdkPromise = undefined
    throw error
  })
  return sdkPromise
}

function authBase(): string {
  return `${import.meta.env.BASE_URL}spotify`
}

export function spotifyLoginUrl(returnTo: string): string {
  return `${authBase()}/login?${new URLSearchParams({ returnTo })}`
}

export async function spotifyAuth<T>(endpoint: string, method = 'GET'): Promise<T> {
  const response = await fetch(`${authBase()}/${endpoint}`, {
    method, cache: 'no-store', signal: AbortSignal.timeout(20000),
  })
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('Spotify authentication server is unavailable. Start the Deno web server (also required during Vite development).')
  }
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Spotify authentication failed (${response.status}).`)
  return data as T
}

export async function spotifyAccessToken(forceRefresh = false): Promise<string> {
  const endpoint = forceRefresh ? 'token?forceRefresh=1' : 'token'
  return (await spotifyAuth<{ accessToken: string }>(endpoint)).accessToken
}

export class SpotifyPlaybackError extends Error {
  readonly httpStatus: number
  readonly spotifyStatus: number

  constructor(
    httpStatus: number,
    spotifyStatus: number,
    detail: string,
  ) {
    super(`Spotify playback failed (HTTP ${httpStatus}, Spotify ${spotifyStatus}): ${detail}`)
    this.httpStatus = httpStatus
    this.spotifyStatus = spotifyStatus
  }
}

async function playbackError(response: Response): Promise<SpotifyPlaybackError> {
  let data: unknown
  try {
    data = await response.json()
  } catch (reason) {
    if (!(reason instanceof SyntaxError)) throw reason
  }
  const error = typeof data === 'object' && data !== null && 'error' in data
    ? data.error : undefined
  const status = typeof error === 'object' && error !== null && 'status' in error
    && typeof error.status === 'number' ? error.status : response.status
  const detail = typeof error === 'object' && error !== null && 'message' in error
    && typeof error.message === 'string'
    ? error.message
    : 'Check your Premium account, app access, and track availability.'
  return new SpotifyPlaybackError(response.status, status, detail)
}

/** Spotify can return HTTP 404 with an authentication error in the response body. */
export async function spotifyPlaybackRequest(
  request: (token: string) => Promise<Response>,
): Promise<void> {
  const response = await request(await spotifyAccessToken())
  if (response.ok) return
  const failure = await playbackError(response)
  if (failure.httpStatus !== 401 && failure.spotifyStatus !== 401) throw failure
  const retry = await request(await spotifyAccessToken(true))
  if (!retry.ok) throw await playbackError(retry)
}
