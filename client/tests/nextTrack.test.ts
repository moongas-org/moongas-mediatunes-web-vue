import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadNextTrack } from '../src/nextTrack.ts'
import type { TrackInfo } from '../src/types.ts'

const current: TrackInfo = {
  path: '/current.mp3', coverPath: '', artist: 'Artist', albumartist: '',
  album: 'Album', title: 'Current', genre: '', year: 2000,
  countryCode: '', regionCode: '', city: '', languageCode: '',
}
const other: TrackInfo = { ...current, path: '/other.mp3', title: 'Other' }
const active = () => true

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

test('removes title, then album, then every remaining filter without mutating the URL', async () => {
  const query = {
    artist: 'Artist', album: 'Album', title: 'Current',
    genre: ['Rock', 'Pop'], custom: 'value', hints: '1',
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
