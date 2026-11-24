import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { MediaFile } from '../src/types'

const server = await createServer({
  server: { middlewareMode: true, hmr: { server: createHttpServer() } },
  appType: 'custom',
})
after(() => server.close())

test('tracks table excludes genre and album artist columns for all results', async (t) => {
  Object.defineProperty(globalThis, 'document', { value: { cookie: '' }, configurable: true })
  t.after(() => { Reflect.deleteProperty(globalThis, 'document') })
  const { api } = await server.ssrLoadModule('/src/api.ts')
  const originalTracks = api.tracks
  const originalArtistGeo = api.artistGeo
  let response: MediaFile[] = []
  api.tracks = async () => ({ files: response, coverPath: '' })
  api.artistGeo = async () => ({ items: [] })
  t.after(() => {
    api.tracks = originalTracks
    api.artistGeo = originalArtistGeo
  })
  const { default: component } = await server.ssrLoadModule('/src/views/TracksView.vue')
  const originalSetup = component.setup
  const testComponent = {
    ...component,
    async setup(props: unknown, context: unknown) {
      const result = originalSetup(props, context)
      await Promise.resolve()
      return result
    },
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tracks', component: testComponent },
      ...['albums', 'artists', 'player'].map((name) => ({ path: `/${name}`, component: { render: () => null } })),
    ],
  })

  const track = (path: string, album: string, albumartist: string, artist = 'Artist'): MediaFile => ({
    id: 1, hasspotify: false, hasmedia: false, haslyricslrc: false, haslyricstxt: false,
    path, size: 0, format: '', title: path, artist, albumartist, album, genre: 'Rock',
    year: 2000, duration: 0, countryCode: '', regionCode: '', city: '', languageCode: '',
  })

  for (const [index, files] of [
    [],
    [track('one', 'Album', 'Artist'), track('two', 'Album', 'Artist', 'Guest')],
    [track('one', 'Album', 'Artist'), track('two', 'Other album', 'Artist')],
    [track('one', 'Album', 'Artist'), track('two', 'Album', 'Other artist')],
    [track('one', 'Album', ''), track('two', 'Album', '')],
    [track('one', 'Album', ''), track('two', 'Album', '', 'Other artist')],
  ].entries()) {
    response = files
    await router.push({ path: '/tracks', query: { artist: 'example', year: String(index) } })
    const app = createSSRApp({ render: () => h(testComponent) })
    app.use(router)
    const html = await renderToString(app)
    const table = html.match(/<table\b[\s\S]*?<\/table>/)?.[0]
    assert.ok(table)
    const headers = [...table.matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((match) => match[1])
    assert.deepEqual(headers, ['Year', 'Artist', 'Album', 'Title'])
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].slice(1)
    assert.equal(rows.length, files.length)
    for (const row of rows) assert.equal((row[1].match(/<td\b/g) ?? []).length, headers.length)
  }
})
