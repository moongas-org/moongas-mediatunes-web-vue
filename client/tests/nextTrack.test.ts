import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  hasAvailablePlaybackSource,
  loadNextTrack,
  loadTrackId,
  loadTrackMediaPath,
} from '../src/nextTrack.ts'
import type { TrackInfo } from '../src/types.ts'

const current: TrackInfo = {
  path: '/current.mp3', coverPath: '', artist: 'Artist', albumartist: '',
  album: 'Album', title: 'Current', genre: '', year: 2000,
  countryCode: '', regionCode: '', city: '', languageCode: '',
}
const other: TrackInfo = { ...current, path: '/other.mp3', title: 'Other' }
const active = () => true

test('requires a streaming source when local playback is disabled', () => {
  const mediafiles = [{ path: '/media/current.mp3' }]
  assert.equal(hasAvailablePlaybackSource(mediafiles, [], false), false)
  assert.equal(hasAvailablePlaybackSource([], [{ trackid: 42 }], false), true)
  assert.equal(hasAvailablePlaybackSource(mediafiles, [{ trackid: 42 }], false), true)
})

test('accepts either local media or streaming when local playback is enabled', () => {
  assert.equal(hasAvailablePlaybackSource([{ path: '/media/current.mp3' }], [], true), true)
  assert.equal(hasAvailablePlaybackSource([], [{ trackid: 42 }], true), true)
  assert.equal(hasAvailablePlaybackSource([], [], true), false)
})

test('resolves the exact track ID for media-file and streaming lookups', async () => {
  const id = await loadTrackId(current, async (query) => {
    assert.deepEqual(query, { artist: current.artist, album: current.album, title: current.title })
    return { files: [{ id: 8, path: other.path }, { id: 42, path: current.path }] }
  }, active)
  assert.equal(id, 42)
})

test('initial load accepts the requested track without relaxing filters', async () => {
  let calls = 0
  const result = await loadNextTrack({ title: 'Current' }, undefined, async (query) => {
    calls++
    assert.deepEqual(query, { title: 'Current' })
    return current
  }, active)
  assert.equal(result?.track, current)
  assert.deepEqual(result?.query, { title: 'Current' })
  assert.equal(calls, 1)
})

test('different track is accepted immediately with all filters intact', async () => {
  let calls = 0
  const result = await loadNextTrack({ album: 'Album' }, current.path, async (query) => {
    calls++
    assert.deepEqual(query, { album: 'Album' })
    return other
  }, active)
  assert.equal(result?.track, other)
  assert.equal(calls, 1)
})

test('skips tracks without media or streaming sources in eligible selections', async () => {
  const unavailable = { ...other, path: '/unavailable.yml', title: 'Unavailable' }
  const requests: unknown[] = []
  const checked: string[] = []
  const result = await loadNextTrack(
    { title: 'Current' },
    current.path,
    async (query) => {
      requests.push(query)
      return requests.length === 1 ? unavailable : other
    },
    active,
    async (candidate) => {
      checked.push(candidate.path)
      return candidate.path === other.path
    },
  )
  assert.equal(result?.track, other)
  assert.deepEqual(result?.query, {})
  assert.deepEqual(requests, [{ title: 'Current' }, {}])
  assert.deepEqual(checked, [unavailable.path, other.path])
})

test('stale eligibility checks neither return a track nor continue relaxing filters', async () => {
  let calls = 0
  let isCurrent = true
  const result = await loadNextTrack({ title: 'Current' }, current.path, async () => {
    calls++
    return other
  }, () => isCurrent, async () => {
    isCurrent = false
    return true
  })
  assert.equal(result, null)
  assert.equal(calls, 1)
})

test('Name That Tune preserves the year range across repeats and unavailable candidates', async () => {
  const filters = { minYear: '1980', maxYear: '1989' }
  const unavailable = { ...other, path: '/unavailable.yml' }
  const candidates = [current, unavailable, other]
  let calls = 0
  const result = await loadNextTrack(filters, current.path, async (query) => {
    assert.deepEqual(query, filters)
    return candidates[calls++]
  }, active, async (candidate) => candidate.path !== unavailable.path, false)
  assert.equal(result?.track, other)
  assert.deepEqual(result?.query, filters)
  assert.equal(calls, 3)
})

test('Name That Tune reports exhausted retries without dropping any filters', async () => {
  for (const candidate of [current, other]) {
    const filters = { minYear: '1980', maxYear: '1989' }
    let calls = 0
    await assert.rejects(loadNextTrack(filters, current.path, async (query) => {
      calls++
      assert.deepEqual(query, filters)
      return candidate
    }, active, async () => false, false), /10 attempts with the selected filters/)
    assert.equal(calls, 10)
    assert.deepEqual(filters, { minYear: '1980', maxYear: '1989' })
  }
})

test('removes title, then album, then every remaining filter without mutating the URL', async () => {
  const query = {
    artist: 'Artist', album: 'Album', title: 'Current',
    genre: ['Rock', 'Pop'], custom: 'value', hints: '1', slideTrackInfo: '1',
    trackInfoFadeDelay: '1000',
    animdur: '45',
  }
  const requests: unknown[] = []
  const result = await loadNextTrack(query, current.path, async (filters) => {
    requests.push(filters)
    return requests.length === 6 ? other : current
  }, active)
  assert.equal(result?.track, other)
  assert.deepEqual(result?.query, {})
  assert.deepEqual(requests, [
    { artist: 'Artist', album: 'Album', title: 'Current', genre: ['Rock', 'Pop'], custom: 'value' },
    { artist: 'Artist', album: 'Album', genre: ['Rock', 'Pop'], custom: 'value' },
    { artist: 'Artist', genre: ['Rock', 'Pop'], custom: 'value' },
    { genre: ['Rock', 'Pop'], custom: 'value' },
    { custom: 'value' },
    {},
  ])
  assert.equal(query.title, 'Current')
  assert.equal(query.album, 'Album')
  assert.deepEqual(query.genre, ['Rock', 'Pop'])
  assert.equal(query.hints, '1')
  assert.equal(query.slideTrackInfo, '1')
  assert.equal(query.trackInfoFadeDelay, '1000')
  assert.equal(query.animdur, '45')
})

test('stops relaxing as soon as a different track is returned', async () => {
  let calls = 0
  const result = await loadNextTrack({
    title: 'Current', album: 'Album', artist: 'Artist',
  }, current.path, async (query) => {
    calls++
    if (calls === 2) {
      assert.deepEqual(query, { album: 'Album', artist: 'Artist' })
      return other
    }
    return current
  }, active)
  assert.equal(result?.track, other)
  assert.deepEqual(result?.query, { album: 'Album', artist: 'Artist' })
  assert.equal(calls, 2)
})

test('skips absent and empty filters and retries unfiltered requests', async () => {
  let calls = 0
  const result = await loadNextTrack({
    artist: 'Artist', title: '', album: null, genre: [null, ''], hints: '1',
  }, current.path, async (query) => {
    calls++
    assert.deepEqual(query, calls === 1 ? { artist: 'Artist' } : {})
    return calls === 4 ? other : current
  }, active)
  assert.equal(result?.track, other)
  assert.deepEqual(result?.query, {})
  assert.equal(calls, 4)
})

test('reports exhaustion after exactly ten unfiltered attempts without returning a repeat', async () => {
  let calls = 0
  await assert.rejects(loadNextTrack({ title: 'Current' }, current.path, async () => {
    calls++
    return current
  }, active), /No different track found after 10 unfiltered attempts/)
  assert.equal(calls, 11)
})

test('an already unfiltered query also stops after ten attempts', async () => {
  let calls = 0
  await assert.rejects(loadNextTrack({}, current.path, async () => {
    calls++
    return current
  }, active), /No different track found/)
  assert.equal(calls, 10)
})

test('propagates API errors without continuing requests', async () => {
  const failure = new Error('API unavailable')
  let calls = 0
  await assert.rejects(loadNextTrack({ title: 'Current' }, current.path, async () => {
    calls++
    throw failure
  }, active), failure)
  assert.equal(calls, 1)
})

test('stale requests neither return a track nor continue relaxing filters', async () => {
  for (const response of [current, other]) {
    let isCurrent = true
    let calls = 0
    const result = await loadNextTrack({ title: 'Current' }, current.path, async () => {
      calls++
      isCurrent = false
      return response
    }, () => isCurrent)
    assert.equal(result, null)
    assert.equal(calls, 1)
  }
})

test('cancelled requests do not contact the API', async () => {
  const result = await loadNextTrack({}, current.path, async () => {
    assert.fail('Unexpected API request')
  }, () => false)
  assert.equal(result, null)
})

test('resolves the selected YAML track by ID and takes only the first media file', async () => {
  const selected = { ...current, path: '/tracks/current.yml' }
  const calls: string[] = []
  const path = await loadTrackMediaPath(selected, async (query) => {
    calls.push('tracks')
    assert.deepEqual(query, { artist: 'Artist', album: 'Album', title: 'Current' })
    return { files: [
      { id: 8, path: '/tracks/another.yml' },
      { id: 42, path: selected.path },
    ] }
  }, async (query) => {
    calls.push('mediafiles')
    assert.deepEqual(query, { trackid: '42' })
    return { mediafiles: [{ path: '/media/current.mp3' }, { path: '/media/current.flac' }] }
  }, active)
  assert.deepEqual(calls, ['tracks', 'mediafiles'])
  assert.equal(path, '/media/current.mp3')
  assert.equal(selected.path, '/tracks/current.yml')
})

test('reports missing track IDs rather than using a YAML path for playback', async () => {
  for (const files of [
    [],
    [{ id: 42, path: '/another.yml' }],
    [{ id: Number.NaN, path: current.path }],
  ]) {
    await assert.rejects(loadTrackMediaPath(current, async () => ({
      files,
    }), async () => {
      assert.fail('Must not request media without a matching track ID')
    }, active), /Unable to find the track ID/)
  }
})

test('returns no playback path for empty media lists and missing media paths', async () => {
  for (const mediafiles of [[], [{ path: '' }]]) {
    const path = await loadTrackMediaPath(current, async () => ({
      files: [{ id: 42, path: current.path }],
    }), async () => ({ mediafiles }), active)
    assert.equal(path, null)
  }
})

test('propagates errors from both track and media-file requests', async () => {
  const failure = new Error('Service unavailable')
  await assert.rejects(loadTrackMediaPath(current, async () => {
    throw failure
  }, async () => {
    assert.fail('Must not request media after a failed tracks request')
  }, active), failure)
  await assert.rejects(loadTrackMediaPath(current, async () => ({
    files: [{ id: 42, path: current.path }],
  }), async () => {
    throw failure
  }, active), failure)
})

test('ignores stale track lookups without requesting media', async () => {
  let isCurrent = true
  const path = await loadTrackMediaPath(current, async () => {
    isCurrent = false
    return { files: [{ id: 42, path: current.path }] }
  }, async () => {
    assert.fail('Must not request media for a stale track')
  }, () => isCurrent)
  assert.equal(path, null)
})

test('ignores stale media-file responses', async () => {
  let isCurrent = true
  const path = await loadTrackMediaPath(current, async () => ({
    files: [{ id: 42, path: current.path }],
  }), async () => {
    isCurrent = false
    return { mediafiles: [{ path: '/stale.mp3' }] }
  }, () => isCurrent)
  assert.equal(path, null)
})

test('cancelled media resolution does not contact either endpoint', async () => {
  const path = await loadTrackMediaPath(current, async () => {
    assert.fail('Unexpected tracks request')
  }, async () => {
    assert.fail('Unexpected mediafiles request')
  }, () => false)
  assert.equal(path, null)
})
