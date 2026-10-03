<script setup lang="ts">
import { computed } from 'vue'
import { configState } from '../configStore'
import { formatSearchQueryUrl } from '../utils/format'
import googleLogoUrl from '../assets/svg/Google_logo.svg'
import spotifyLogoUrl from '../assets/svg/Spotify_icon.svg'
import tidalLogoUrl from '../assets/svg/Tidal_logo.svg'
import youtubeLogoUrl from '../assets/svg/YouTube_logo.svg'
import youtubeMusicLogoUrl from '../assets/svg/YouTube_Music_logo.svg'
import appleLogoUrl from '../assets/svg/Apple_logo.svg'
import amazonLogoUrl from '../assets/svg/Amazon_logo.svg'
import deezerLogoUrl from '../assets/svg/Deezer_logo.svg'
import bandcampLogoUrl from '../assets/svg/Bandcamp_logo.svg'
import discogsLogoUrl from '../assets/svg/Discogs_logo.svg'
import musicBrainzLogoUrl from '../assets/svg/MusicBrainz_logo.svg'
import wikipediaLogoUrl from '../assets/svg/Wikipedia_logo.svg'
import soundcloudLogoUrl from '../assets/svg/SoundCloud_logo.svg'
import lastFmLogoUrl from '../assets/svg/Lastfm_logo.svg'

/** Renders the ribbon of web-search playback links for a given artist/album(/title). */
const props = withDefaults(
  defineProps<{ artist: string; album: string; title?: string }>(),
  { title: '' },
)

interface WebSearchLink {
  name: string
  url: string
}

const webSearchLinks = computed<WebSearchLink[]>(() => {
  const methods = configState.config?.webSearchPlaybackMethods ?? []
  return methods.map((m) => ({
    name: m.name,
    url: formatSearchQueryUrl(m.searchQueryUrlFormat, props.artist, props.album, props.title),
  }))
})

function isGoogleLink(url: string): boolean {
  return url.toLowerCase().includes('google.com') && !url.toLowerCase().includes('q=spotify:search') && !url.toLowerCase().includes('q=tidal:search')
}

function isSpotifyLink(url: string): boolean {
  return url.toLowerCase().includes('spotify.com') || url.toLowerCase().includes('q=spotify:search')
}

function isAppleLink(url: string): boolean {
  return url.toLowerCase().includes('apple.com')
}

function isAmazonLink(url: string): boolean {
  return url.toLowerCase().includes('amazon.com')
}

function isTidalLink(url: string): boolean {
  return url.toLowerCase().includes('tidal.com') || url.toLowerCase().includes('q=tidal:search')
}

function isYoutubeLink(url: string): boolean {
  return url.toLowerCase().includes('youtube.com') && !url.toLowerCase().includes('music.youtube.com')
}

function isYoutubeMusicLink(url: string): boolean {
  return url.toLowerCase().includes('music.youtube.com')
}

function isDeezerLink(url: string): boolean {
  return url.toLowerCase().includes('deezer.com')
}

function isDiscogsLink(url: string): boolean {
  return url.toLowerCase().includes('discogs.com')
}

function isBandcampLink(url: string): boolean {
  return url.toLowerCase().includes('bandcamp.com')
}

function isMusicBrainzLink(url: string): boolean {
  return url.toLowerCase().includes('musicbrainz.org')
}

function isWikipediaLink(url: string): boolean {
  return url.toLowerCase().includes('wikipedia.org')
}

function isSoundcloudLink(url: string): boolean {
  return url.toLowerCase().includes('soundcloud.com')
}

function isLastFmLink(url: string): boolean {
  return url.toLowerCase().includes('last.fm')
}
</script>

<template>
  <a
    v-for="link in webSearchLinks"
    :key="link.name"
    class="playback-option"
    :href="link.url"
    target="_blank"
    rel="noopener noreferrer"
  >
    <img v-if="isGoogleLink(link.url)" :src="googleLogoUrl" class="playback-link-icon" alt="" />
    <img
      v-else-if="isSpotifyLink(link.url)"
      :src="spotifyLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isTidalLink(link.url)"
      :src="tidalLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isYoutubeLink(link.url)"
      :src="youtubeLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isYoutubeMusicLink(link.url)"
      :src="youtubeMusicLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isAppleLink(link.url)"
      :src="appleLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isAmazonLink(link.url)"
      :src="amazonLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isDeezerLink(link.url)"
      :src="deezerLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isDiscogsLink(link.url)"
      :src="discogsLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isBandcampLink(link.url)"
      :src="bandcampLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isMusicBrainzLink(link.url)"
      :src="musicBrainzLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isWikipediaLink(link.url)"
      :src="wikipediaLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isSoundcloudLink(link.url)"
      :src="soundcloudLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <img
      v-else-if="isLastFmLink(link.url)"
      :src="lastFmLogoUrl"
      class="playback-link-icon"
      alt=""
    />
    <template v-else>🔍</template
    >{{ link.name }}
  </a>
</template>
