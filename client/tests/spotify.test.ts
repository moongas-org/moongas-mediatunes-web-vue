import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectSpotifyTrack } from '../src/spotify.ts'
import { createSpotifyHandler } from '../../server/spotify.ts'

const firstId = '1DEs2q7YZCTy8M7kTYp3ia'
const secondId = '2DEs2q7YZCTy8M7kTYp3ia'

test('selects the first Spotify result, not a preceding different service or later Spotify result', () => {
  assert.deepEqual(selectSpotifyTrack([
    { trackid: 1, streaming_service: 'youtube', streaming_track_id: 'youtube-id' },
    { trackid: 1, streaming_service: 'spotify', streaming_track_id: firstId },
    { trackid: 1, streaming_service: 'spotify', streaming_track_id: secondId },
  ]), { trackId: firstId, error: null })
  assert.deepEqual(selectSpotifyTrack([]), { trackId: null, error: null })
  assert.deepEqual(selectSpotifyTrack([{ trackid: 1, streamingservice: 'spotify', streamingtrackid: firstId }]),
    { trackId: firstId, error: null })
})

test('invalid first Spotify ID is reported, not silently replaced by the second entry', () => {
  const result = selectSpotifyTrack([
    { trackid: 1, streaming_service: 'spotify', streaming_track_id: '../invalid' },
    { trackid: 1, streaming_service: 'spotify', streaming_track_id: secondId },
  ])
  assert.equal(result.trackId, null)
  assert.match(result.error!, /invalid streaming_track_id/)
})

const base = 'https://music.example/mediatunes/spotify'
type Handler = ReturnType<typeof createSpotifyHandler>

async function login(handler: Handler) {
  const response = await handler(new Request(`${base}/login?returnTo=${encodeURIComponent('/mediatunes/player?artist=Test&title=Song')}`))
  assert.equal(response.status, 302)
  assert.match(response.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax; Path=\/mediatunes\/spotify/)
  assert.match(response.headers.get('set-cookie')!, /Secure/)
  const cookie = response.headers.get('set-cookie')!.split(';')[0]
  const authorize = new URL(response.headers.get('location')!)
  assert.equal(authorize.origin, 'https://accounts.spotify.com')
  assert.equal(authorize.searchParams.get('redirect_uri'), `${base}/callback`)
  assert.match(authorize.searchParams.get('scope')!, /streaming/)
  assert.match(authorize.searchParams.get('scope')!, /user-modify-playback-state/)
  return { cookie, state: authorize.searchParams.get('state')! }
}

test('OAuth keeps secrets server-side, validates state, returns to filters, and logs out', async () => {
  const handler = createSpotifyHandler({
    basePath: '/mediatunes', clientId: 'test-client', clientSecret: 'test-secret',
    fetch: async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('authorization'), `Basic ${btoa('test-client:test-secret')}`)
      const body = new URLSearchParams(String(init?.body))
      assert.equal(body.get('grant_type'), 'authorization_code')
      assert.equal(body.get('code'), 'test-code')
      return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 })
    },
  })
  const { cookie, state } = await login(handler)
  const invalid = await handler(new Request(`${base}/callback?state=wrong&code=test-code`, { headers: { cookie } }))
  assert.equal(invalid.status, 400)
  const callback = await handler(new Request(`${base}/callback?state=${state}&code=test-code`, { headers: { cookie, 'sec-fetch-site': 'cross-site' } }))
  assert.equal(callback.headers.get('location'), '/mediatunes/player?artist=Test&title=Song')
  const replay = await handler(new Request(`${base}/callback?state=${state}&code=test-code`, { headers: { cookie } }))
  assert.equal(replay.status, 400)
  const token = await handler(new Request(`${base}/token`, { headers: { cookie } }))
  assert.deepEqual(await token.json(), { accessToken: 'access' })
  assert.equal(token.headers.get('cache-control'), 'no-store')
  const logout = await handler(new Request(`${base}/logout`, { method: 'POST', headers: { cookie, origin: 'https://music.example' } }))
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/)
  assert.equal((await handler(new Request(`${base}/token`, { headers: { cookie } }))).status, 401)
})

test('refreshes expiring tokens once for concurrent SDK requests', async () => {
  let refreshes = 0
  const handler = createSpotifyHandler({
    basePath: '/mediatunes', clientId: 'test-client', clientSecret: 'test-secret',
    fetch: async (_input, init) => {
      const body = new URLSearchParams(String(init?.body))
      if (body.get('grant_type') === 'refresh_token') {
        refreshes++
        assert.equal(body.get('refresh_token'), 'refresh')
        await new Promise((resolve) => setTimeout(resolve, 5))
        return Response.json({ access_token: 'new-access', expires_in: 3600 })
      }
      return Response.json({ access_token: 'old-access', refresh_token: 'refresh', expires_in: 30 })
    },
  })
  const { cookie, state } = await login(handler)
  await handler(new Request(`${base}/callback?state=${state}&code=test-code`, { headers: { cookie } }))
  const responses = await Promise.all([1, 2].map(() => handler(new Request(`${base}/token`, { headers: { cookie } }))))
  for (const response of responses) assert.deepEqual(await response.json(), { accessToken: 'new-access' })
  assert.equal(refreshes, 1)
})

test('reports declined login, rejects open redirects and cross-origin access, and handles missing configuration', async () => {
  const handler = createSpotifyHandler({ basePath: '/mediatunes', clientId: 'id', clientSecret: 'secret' })
  assert.equal((await handler(new Request(`${base}/login?returnTo=https://evil.example`))).status, 400)
  assert.equal((await handler(new Request(`${base}/login?returnTo=http://[`))).status, 400)
  assert.equal((await handler(new Request(`${base}/token`, { headers: { origin: 'https://evil.example' } }))).status, 403)
  assert.equal((await handler(new Request(`${base}/token`, { headers: { 'sec-fetch-site': 'cross-site' } }))).status, 403)
  const { cookie, state } = await login(handler)
  await handler(new Request(`${base}/callback?state=${state}&error=access_denied`, { headers: { cookie } }))
  const status = await handler(new Request(`${base}/status`, { headers: { cookie } }))
  const data = await status.json()
  assert.equal(data.authenticated, false)
  assert.match(data.error, /declined/)
  const unconfigured = createSpotifyHandler({ basePath: '/mediatunes' })
  assert.deepEqual(await (await unconfigured(new Request(`${base}/status`))).json(), { configured: false, authenticated: false })
  assert.equal((await unconfigured(new Request(`${base}/login`))).status, 503)
})

test('uses the registered public origin for reverse-proxied login and logout', async () => {
  const handler = createSpotifyHandler({
    basePath: '/mediatunes', clientId: 'id', clientSecret: 'secret',
    redirectUri: `${base}/callback`,
  })
  const response = await handler(new Request('http://internal:8000/mediatunes/spotify/login?returnTo=/mediatunes/player'))
  assert.equal(response.status, 302)
  const authorize = new URL(response.headers.get('location')!)
  assert.equal(authorize.searchParams.get('redirect_uri'), `${base}/callback`)
  const cookie = response.headers.get('set-cookie')!.split(';')[0]
  const logout = await handler(new Request('http://internal:8000/mediatunes/spotify/logout', {
    method: 'POST', headers: { cookie, origin: 'https://music.example' },
  }))
  assert.equal(logout.status, 200)
})

test('reports revoked refresh tokens and clears authentication instead of returning a stale access token', async (t) => {
  t.mock.method(console, 'error', () => {})
  const handler = createSpotifyHandler({
    basePath: '/mediatunes', clientId: 'id', clientSecret: 'secret',
    fetch: async (_input, init) => {
      const body = new URLSearchParams(String(init?.body))
      return body.get('grant_type') === 'refresh_token'
        ? Response.json({ error: 'invalid_grant' }, { status: 400 })
        : Response.json({ access_token: 'old', refresh_token: 'revoked', expires_in: 30 })
    },
  })
  const { cookie, state } = await login(handler)
  await handler(new Request(`${base}/callback?state=${state}&code=code`, { headers: { cookie } }))
  const token = await handler(new Request(`${base}/token`, { headers: { cookie } }))
  assert.equal(token.status, 502)
  assert.match((await token.json()).error, /reconnect/)
  const status = await handler(new Request(`${base}/status`, { headers: { cookie } }))
  assert.equal((await status.json()).authenticated, false)
  assert.equal((await handler(new Request(`${base}/token`, { headers: { cookie } }))).status, 401)
})
