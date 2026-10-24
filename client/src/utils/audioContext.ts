type PlaybackContext = Pick<AudioContext, 'state' | 'resume'>

/** Device changes can suspend the browser context without updating Howler's state. */
export async function resumeAudioContext(
  context: PlaybackContext,
  timeoutMs = 4000,
): Promise<void> {
  const isRunning = () => context.state === 'running'
  if (isRunning()) return
  if (context.state === 'closed') {
    throw new Error('The audio device context has closed. Reload the player to reconnect.')
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      context.resume(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Audio device did not resume. Press Play to retry.')), timeoutMs)
      }),
    ])
    if (!isRunning()) {
      throw new Error('Audio is still interrupted. Press Play to reconnect to the audio device.')
    }
  } finally {
    clearTimeout(timer)
  }
}
