import { createRouter, createWebHistory } from 'vue-router'

const AlbumsView = () => import('./views/AlbumsView.vue')
const ArtistsView = () => import('./views/ArtistsView.vue')
const ArtistView = () => import('./views/ArtistView.vue')
const ArtistGeoCodesView = () => import('./views/ArtistGeoCodesView.vue')
const GenresView = () => import('./views/GenresView.vue')
const GenreView = () => import('./views/GenreView.vue')
const TracksView = () => import('./views/TracksView.vue')
const PlayerView = () => import('./views/PlayerView.vue')
const WordCloudView = () => import('./views/WordCloudView.vue')

/**
 * Route meta:
 * - bare: no header/footer (word clouds)
 * - noYears: header without the year prev/next nav (player, tracks)
 */
export const router = createRouter({
  // Serve under the Vite `base` path (e.g. /mediatunes/) so history-mode
  // routes work identically in dev (root) and prod (sub-path).
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'root', redirect: (to) => ({ path: '/albums', query: to.query, hash: to.hash }) },
    { path: '/albums', name: 'albums', component: AlbumsView },
    {
      path: '/tracks',
      name: 'tracks',
      component: TracksView,
      meta: { noYears: true },
    },
    { path: '/artists', name: 'artists', component: ArtistsView },
    { path: '/artist', name: 'artist', component: ArtistView },
    { path: '/genres', name: 'genres', component: GenresView },
    { path: '/genre', name: 'genre', component: GenreView },
    {
      path: '/artist-countries',
      name: 'artist-countries',
      component: ArtistGeoCodesView,
      meta: { geoKind: 'countries' },
    },
    {
      path: '/artist-regions',
      name: 'artist-regions',
      component: ArtistGeoCodesView,
      meta: { geoKind: 'regions' },
    },
    {
      path: '/artist-cities',
      name: 'artist-cities',
      component: ArtistGeoCodesView,
      meta: { geoKind: 'cities' },
    },
    {
      path: '/artist-languages',
      name: 'artist-languages',
      component: ArtistGeoCodesView,
      meta: { geoKind: 'languages' },
    },
    { path: '/player', name: 'player', component: PlayerView, meta: { noYears: true } },
    {
      path: '/name-that-tune/',
      name: 'name-that-tune',
      component: PlayerView,
      props: { hints: true },
    },
    {
      path: '/genres-cloud',
      name: 'genres-cloud',
      component: WordCloudView,
      meta: { bare: true, cloudType: 'genre' },
    },
    {
      path: '/artists-cloud',
      name: 'artists-cloud',
      component: WordCloudView,
      meta: { bare: true, cloudType: 'artist' },
    },
  ],
})
