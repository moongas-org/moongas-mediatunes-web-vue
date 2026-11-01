import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const { api }: { api: typeof import('../src/api.ts').api } =
  await server.ssrLoadModule('/src/api.ts')
after(() => server.close())

test('fetches YAML as unmodified text through the base-prefixed getfile endpoint', async (t) => {
  const text = 'trackData:\n  title: <b>Test Track</b>\n'
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/mediatunes/getfile/music/Artist/Album/track.yml')
    assert.equal(options.signal, controller.signal)
    return new Response(text, { headers: { 'content-type': 'application/yaml' } })
  })
  assert.equal(await api.fileText('/music/Artist/Album/track.yml', controller.signal), text)
})

test('missing optional YAML files are unavailable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Missing', { status: 404 }))
  assert.equal(await api.fileText('/music/Artist/artist.yml'), null)
})

test('empty existing text files remain available', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(''))
  assert.equal(await api.fileText('/music/Artist/Album/album.yml'), '')
})

test('unexpected server errors and HTML responses are not treated as file contents', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    new Response('Unavailable', { status: 500 }))
  await assert.rejects(api.fileText('/album.yml'), /failed: 500/)
  fetchMock.mock.mockImplementation(async () =>
    new Response('<html>Fallback</html>', { headers: { 'content-type': 'text/html' } }))
  await assert.rejects(api.fileText('/album.yml'), /returned HTML, not text/)
})

test('network errors propagate to the caller', async (t) => {
  const failure = new Error('Network unavailable')
  t.mock.method(globalThis, 'fetch', async () => { throw failure })
  await assert.rejects(api.fileText('/artist.yml'), failure)
})

test('lyrics continue to use media sidecar paths through the shared text fetcher', async (t) => {
  const urls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url)
    return new Response('Lyrics')
  })
  assert.equal(await api.lyrics('/music/track.mp3', '.txt'), 'Lyrics')
  assert.equal(await api.lyrics('/music/track.mp3', '.lrc'), 'Lyrics')
  assert.deepEqual(urls, [
    '/mediatunes/getfile/music/track.txt',
    '/mediatunes/getfile/music/track.lrc',
  ])
})
