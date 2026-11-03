export interface LrcLine {
  time: number
  text: string
}

export function parseLrc(text: string): LrcLine[] {
  const offset = Number(text.match(/^\s*\[offset:([+-]?\d+)\]\s*$/im)?.[1] ?? 0) / 1000
  const lines: LrcLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const timestamps = [...raw.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)]
    if (!timestamps.length || raw.slice(0, timestamps[0].index).trim()) continue
    const lyric = raw.slice(timestamps.at(-1)!.index! + timestamps.at(-1)![0].length).trim()
    for (const stamp of timestamps) {
      const time = Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] ?? 0}`) + offset
      if (Number.isFinite(time)) lines.push({ time: Math.max(0, time), text: lyric })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function activeLrcIndex(lines: readonly LrcLine[], position: number): number {
  let low = 0
  let high = lines.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (lines[middle].time <= position) low = middle + 1
    else high = middle
  }
  return low - 1
}
