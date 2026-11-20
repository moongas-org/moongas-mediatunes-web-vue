import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createRenderer, h, nextTick, reactive, ssrContextKey, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { SpotifyPlayer, SpotifyState } from '../src/spotify.ts'

const server = await createServer({
  server: { middlewareMode: true, hmr: { server: createHttpServer() } },
  appType: 'custom',
})
const { spotifyPlaybackRequest, SpotifyPlaybackError }: typeof import('../src/spotify.ts') =
  await server.ssrLoadModule('/src/spotify.ts')
after(() => server.close())

test('refreshes and retries the reported HTTP 404 with nested Spotify 401', async (t) => {
  const tokenUrls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    tokenUrls.push(url)
    return Response.json({ accessToken: tokenUrls.length === 1 ? 'old' : 'fresh' })
  })
  const tokens: string[] = []
  await spotifyPlaybackRequest(async (token) => {
    tokens.push(token)
    return tokens.length === 1
      ? Response.json({ error: { status: 401, message: 'Missing/invalid/expired access token' } }, { status: 404 })
      : new Response(null, { status: 204 })
  })
  assert.deepEqual(tokens, ['old', 'fresh'])
  assert.deepEqual(tokenUrls, [
    '/mediatunes/spotify/token',
    '/mediatunes/spotify/token?forceRefresh=1',
  ])
})

test('distinguishes a missing device from invalid authentication without refreshing', async (t) => {
  let tokenRequests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    tokenRequests++
    return Response.json({ accessToken: 'valid' })
  })
  await assert.rejects(spotifyPlaybackRequest(async () =>
    Response.json({ error: { status: 404, message: 'Device not found' } }, { status: 404 })),
  (error: unknown) => {
    assert.ok(error instanceof SpotifyPlaybackError)
    assert.equal(error.httpStatus, 404)
    assert.equal(error.spotifyStatus, 404)
    assert.match(error.message, /Device not found/)
    return true
  })
  assert.equal(tokenRequests, 1)
})

test('retries authentication only once and preserves both error statuses', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ accessToken: 'invalid' }))
  let attempts = 0
  await assert.rejects(spotifyPlaybackRequest(async () => {
    attempts++
    return Response.json({ error: { status: 401, message: 'Expired token' } }, { status: 404 })
  }), /HTTP 404, Spotify 401.*Expired token/)
  assert.equal(attempts, 2)
})

test('reports non-JSON playback failures instead of hiding the HTTP status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ accessToken: 'valid' }))
  await assert.rejects(spotifyPlaybackRequest(async () =>
    new Response('Unavailable', { status: 503 })), /HTTP 503/)
})

test('keeps the SDK device across track changes and reconnects a missing device without logout', async (t) => {
  const { default: component }: { default: Component } =
    await server.ssrLoadModule('/src/components/SpotifyPlayer.vue')
  const devices: MockPlayer[] = []
  type SDKOptions = ConstructorParameters<NonNullable<Window['Spotify']>['Player']>[0]
  class MockPlayer extends EventTarget implements SpotifyPlayer {
    disconnects = 0
    pauses = 0
    state: SpotifyState | null = null
    options: SDKOptions
    constructor(options: SDKOptions) {
      super()
      this.options = options
      devices.push(this)
    }
    addListener: SpotifyPlayer['addListener'] = (event, callback) => {
      this.addEventListener(event, (value) => {
        if (value instanceof CustomEvent) callback(value.detail)
      })
      return true
    }
    async connect() {
      this.options.getOAuthToken(() => {
        this.dispatchEvent(new CustomEvent('ready', { detail: { device_id: `device-${devices.indexOf(this)}` } }))
      })
      return true
    }
    disconnect() { this.disconnects++ }
    async activateElement() {}
    async pause() { this.pauses++ }
    async resume() {}
    async seek() {}
    async setVolume() {}
    async getCurrentState() { return this.state }
  }
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { Spotify: { Player: MockPlayer } } })
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  const requests: string[] = []
  let missingDevice = false
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    requests.push(url)
    if (url.endsWith('/status')) return Response.json({ configured: true, authenticated: true })
    if (url.includes('/token')) return Response.json({ accessToken: 'valid-token' })
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer valid-token')
    return missingDevice
      ? Response.json({ error: { status: 404, message: 'Device not found' } }, { status: 404 })
      : new Response(null, { status: 204 })
  })

  const renderer = createRenderer<object, object>({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  await router.push('/')
  const props = reactive<{ trackId?: string }>({ trackId: '1DEs2q7YZCTy8M7kTYp3ia' })
  const app = renderer.createApp({ render: () => h(Object.assign(component, { render: () => null }), props) })
  app.use(router)
  app.provide(ssrContextKey, {})
  app.mount({})
  t.after(() => app.unmount())
  const flush = async () => {
    await new Promise((resolve) => setImmediate(resolve))
    await nextTick()
  }
  await flush()
  const instance = app._instance?.subTree.component
  assert.ok(instance)
  const play = instance.setupState.togglePlayback
  assert.equal(typeof play, 'function')
  await play()
  assert.equal(devices.length, 1)

  props.trackId = undefined
  await nextTick()
  props.trackId = '2DEs2q7YZCTy8M7kTYp3ia'
  await flush()
  await play()
  assert.equal(devices.length, 1)
  assert.equal(devices[0].disconnects, 0)
  assert.ok(devices[0].pauses > 0)
  assert.equal(requests.filter((url) => url.includes('/me/player/play')).length, 2)
  devices[0].dispatchEvent(new CustomEvent('player_state_changed', { detail: {
    paused: false, position: 10000, duration: 200000,
    track_window: { current_track: { uri: 'spotify:track:1DEs2q7YZCTy8M7kTYp3ia' } },
  } }))
  assert.equal(instance.setupState.isPlaying, false)
  assert.equal(instance.setupState.position, 0)

  missingDevice = true
  await play()
  assert.equal(devices.length, 2)
  assert.equal(devices[0].disconnects, 1)
  assert.match(instance.setupState.error, /reconnected.*Press Play/)
  assert.ok(requests.some((url) => url.endsWith('/token?forceRefresh=1')))
  assert.ok(!requests.some((url) => url.includes('/logout') || url.includes('/login')))
  missingDevice = false
  await play()
  assert.match(requests.at(-1)!, /device_id=device-1/)
})
