import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activeLrcIndex, parseLrc } from '../src/utils/lrc.ts'

test('parses timestamps, fractional seconds, repeated timestamps, and sorts lines', () => {
  assert.deepEqual(parseLrc('[ar:Artist]\n[00:20.123]Second\n[00:01.5][00:10.50]First\n[01:00]Last'), [
    { time: 1.5, text: 'First' },
    { time: 10.5, text: 'First' },
    { time: 20.123, text: 'Second' },
    { time: 60, text: 'Last' },
  ])
})

test('applies signed millisecond offsets and preserves empty instrumental cues', () => {
  assert.deepEqual(parseLrc('[offset:-1500]\n[00:01]Early\n[00:05]\n'), [
    { time: 0, text: 'Early' }, { time: 3.5, text: '' },
  ])
  assert.equal(parseLrc('[offset:+500]\n[00:01]Line')[0].time, 1.5)
})

test('ignores plain text, metadata, malformed timestamps and empty input', () => {
  assert.deepEqual(parseLrc(''), [])
  assert.deepEqual(parseLrc('plain lyrics\n[ar:Artist]\n[00:99]Invalid\nnot a cue [00:01]'), [])
})

test('selects active lines at boundaries and after forward/backward seeks', () => {
  const lines = parseLrc('[00:05]First\n[00:10]Second\n[00:20]Third')
  assert.equal(activeLrcIndex(lines, 0), -1)
  assert.equal(activeLrcIndex(lines, 5), 0)
  assert.equal(activeLrcIndex(lines, 9.999), 0)
  assert.equal(activeLrcIndex(lines, 10), 1)
  assert.equal(activeLrcIndex(lines, 99), 2)
  assert.equal(activeLrcIndex(lines, 6), 0)
  assert.equal(activeLrcIndex([], 1), -1)
})
