'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserAudioLayers } from '@/lib/meditation/audio'
import type { AmbientSettings } from '@/lib/meditation/types'

/** A user-started sound check, separate from the session clock and speech. */
export function useAmbientPreview(settings: AmbientSettings) {
  const audioRef = useRef<BrowserAudioLayers | null>(null)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const canTest = [settings.brownNoise, settings.rain].some(layer => layer.enabled && layer.volume > 0)

  // Release synchronously: a new meditation must never share this sound owner.
  const release = useCallback(() => {
    const audio = audioRef.current
    audioRef.current = null
    audio?.destroy()
  }, [])

  const stop = useCallback(() => {
    release()
    setTesting(false)
    setError(null)
    setNote(null)
  }, [release])

  function start() {
    if (!canTest) return
    release()
    const audio = new BrowserAudioLayers()
    audioRef.current = audio
    setError(null)
    setNote(null)
    setTesting(true)
    const reportError = () => {
      if (audioRef.current === audio) setError('The browser reported an audio problem. Try Restore background sound, or stop the test.')
    }
    audio.setErrorHandler(reportError)
    try {
      audio.setAmbient(settings)
      audio.unlock() // Keep this synchronous inside the Test button gesture.
    } catch { reportError() }
  }

  function recover() {
    const audio = audioRef.current
    if (!audio) return
    setError(null)
    try { audio.recover() }
    catch { setError('Background sound could not be requested again. Stop the test, then tap Test background sounds to retry.') }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!canTest) { stop(); return }
    try { audio.setAmbient(settings) }
    catch { setError('The browser could not update the sound test. Try Restore background sound, or stop the test.') }
  }, [settings, canTest, stop])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden' || !audioRef.current) return
      stop()
      setNote('The sound test stopped when this page went into the background. Tap Test background sounds to try again.')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      release()
    }
  }, [release, stop])

  return { testing, canTest, error, note, start, stop, recover }
}
