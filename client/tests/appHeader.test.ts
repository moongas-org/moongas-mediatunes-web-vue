import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createRenderer, h, nextTick, ssrContextKey, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const server = await createServer({
  server: { middlewareMode: true, hmr: { server: createHttpServer() } },
  appType: 'custom',
})
after(() => server.close())

test('view selection survives filters and trailing slashes on every header route', async (t) => {
  const { default: component }: { default: Component } =
    await server.ssrLoadModule('/src/components/AppHeader.vue')
  const paths = [
    'albums', 'artists', 'genres', 'player', 'name-that-tune', 'tracks',
    'artist', 'genre', 'artist-countries', 'artist-regions', 'artist-cities', 'artist-languages',
  ]
  const router = createRouter({
    history: createMemoryHistory(),
    routes: paths.map((name) => ({ path: `/${name}`, name, component: { render: () => null } })),
  })
  await router.push('/albums')
  const renderer = createRenderer<object, object>({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp({
    render: () => h(Object.assign(component, { render: () => null })),
  })
  app.use(router)
  app.provide(ssrContextKey, {})
  app.mount({})
  t.after(() => app.unmount())
  const instance = app._instance?.subTree.component
  assert.ok(instance)
  for (const path of paths) {
    for (const suffix of ['', '/', '?year=2000', '/?year=2000&genre=Rock']) {
      await router.push(`/${path}${suffix}`)
      await nextTick()
      assert.equal(instance.setupState.selectedView, `/${path}`)
      const options: { label: string; path: string }[] = instance.setupState.viewLinks
      assert.ok(options.some((option) => option.path === `/${path}`))
      assert.ok(options.every((option) => option.path !== '' && option.label !== 'Select a view'))
    }
  }
})
