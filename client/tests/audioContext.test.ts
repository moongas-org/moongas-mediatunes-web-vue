import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resumeAudioContext } from '../src/utils/audioContext.ts'

test('running audio context does not need resuming', async () => {
  await resumeAudioContext({
    state: 'running',
    resume: async () => { assert.fail('Unexpected resume') },
  })
})

test('externally suspended context resumes even if Howler thinks it is running', async () => {
  let state: AudioContextState = 'suspended'
  let calls = 0
  await resumeAudioContext({
    get state() { return state },
    resume: async () => { calls++; state = 'running' },
  })
  assert.equal(calls, 1)
  assert.equal(state, 'running')
})

test('closed device context reports a reload action', async () => {
  await assert.rejects(resumeAudioContext({
    state: 'closed',
    resume: async () => { assert.fail('Cannot resume closed context') },
  }), /Reload the player/)
})

test('resume rejection is surfaced', async () => {
  await assert.rejects(resumeAudioContext({
    state: 'suspended',
    resume: async () => { throw new Error('Device unavailable') },
  }), /Device unavailable/)
})

test('resolved resume that stays suspended is not reported as success', async () => {
  await assert.rejects(resumeAudioContext({
    state: 'suspended',
    resume: async () => {},
  }), /still interrupted/)
})

test('a stalled resume times out so Play is not disabled forever', async () => {
  await assert.rejects(resumeAudioContext({
    state: 'suspended',
    resume: () => new Promise<void>(() => {}),
  }, 10), /Press Play to retry/)
})
