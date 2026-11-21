import type { UnitType } from './types'

/** Keep composition estimates and browser speech rendering on the same pacing. */
export const SPEECH_SPEED_FACTOR = 0.85
export const DIALOGUE_TURN_PAUSE_SECONDS = 0.75

export function speechRate(type: UnitType): number {
  return (type === 'cinematic-dialogue' ? 0.94 : 0.87) * SPEECH_SPEED_FACTOR
}

export function sentencePauseSeconds(type: UnitType): number {
  return type === 'cinematic-dialogue' ? 0.75 : 1.2
}

const TITLE_ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'sr', 'jr', 'st', 'rev', 'hon'])
const INLINE_ABBREVIATIONS = new Set(['e.g', 'i.e', 'vs', 'no', 'fig', 'approx', 'dept', 'inc', 'etc', 'a.m', 'p.m'])

/** Complete sentences, retaining punctuation and closing quotes. No word is removed
 * or rewritten. Whitespace at a boundary is represented by the scheduled pause. */
export function splitSpeechSentences(text: string): string[] {
  const source = text.trim()
  if (!source) return []
  const result: string[] = []
  let start = 0
  for (let index = 0; index < source.length; index++) {
    const punctuation = source[index]
    if (!'.!?…'.includes(punctuation)) continue
    if (punctuation === '.' && /\d/.test(source[index - 1] ?? '') && /\d/.test(source[index + 1] ?? '')) continue
    let end = index + 1
    while (end < source.length && '.!?…'.includes(source[end])) end++
    const repeated = end > index + 1
    while (end < source.length && /["'”’»\)\]\}]/.test(source[end])) end++
    // A period inside a word/acronym is not a sentence boundary.
    if (end < source.length && !/\s/.test(source[end])) continue
    const remainder = source.slice(end).trimStart()
    if (punctuation === '.' && !repeated && remainder) {
      const token = source.slice(start, index).match(/([A-Za-z.]+)$/)?.[1] ?? ''
      const lowerToken = token.toLowerCase()
      if (TITLE_ABBREVIATIONS.has(lowerToken)) continue
      if (INLINE_ABBREVIATIONS.has(lowerToken) && !/^[A-Z]/.test(remainder)) continue
      if (lowerToken === 'e.g' || lowerToken === 'i.e') continue
      // Initials and dotted acronyms are common inside names and places.
      if (/^[A-Z]$/.test(token) || /^(?:[A-Z]\.)+[A-Z]$/.test(token)) continue
    }
    const sentence = source.slice(start, end).trim()
    if (sentence) result.push(sentence)
    start = end
    index = end - 1
  }
  const tail = source.slice(start).trim()
  if (tail) result.push(tail)
  return result
}
