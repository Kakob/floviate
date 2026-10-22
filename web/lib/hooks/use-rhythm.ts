import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase-client'
import { dayBounds } from '@/lib/day-scenes'
import { addDays } from '@/lib/day-planner'
import {
  NO_FEELINGS,
  TREND_DAYS,
  liveEntries,
  preparePatch,
  validateMark,
  type RhythmActivityKey,
  type RhythmEntry,
  type RhythmKind,
  type RhythmMark,
  type RhythmPatch,
  type RhythmPeak,
} from '@/lib/rhythm'

export const rhythmKeys = {
  all: (userId: string | undefined) => ['rhythm', userId] as const,
  /** Every cached list of entries, so optimistic changes reach the window and the live list alike. */
  entries: (userId: string | undefined) => ['rhythm', userId, 'entries'] as const,
  window: (userId: string | undefined, endDate: string) => ['rhythm', userId, 'entries', endDate] as const,
  live: (userId: string | undefined) => ['rhythm', userId, 'entries', 'live'] as const,
  peaks: (userId: string | undefined) => ['rhythm', userId, 'peaks'] as const,
}

/** Supabase caps a response at 1,000 rows by default; heavy days can exceed that within the window. */
const PAGE = 1000

const WITH_MARKS = '*, marks:rhythm_marks(*)'

const sortMarks = (entry: RhythmEntry): RhythmEntry => ({
  ...entry,
  marks: [...(entry.marks ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
})

/**
 * Rhythm entries for the trend window ending at `endDate`, plus the window before it so
 * week-over-week comparisons have something to compare against. Also every live session,
 * however long ago it started, so one begun before midnight still shows as running.
 */
export function useRhythm(endDate: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = rhythmKeys.window(user?.id, endDate)
  const { start } = dayBounds(addDays(endDate, -2 * TREND_DAYS + 1))
  const { end } = dayBounds(endDate)

  const entries = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<RhythmEntry[]> => {
      const rows: RhythmEntry[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('rhythm_entries')
          .select(WITH_MARKS)
          .eq('user_id', user!.id)
          .gte('occurred_at', start)
          .lt('occurred_at', end)
          .order('occurred_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...(data ?? []).map(sortMarks))
        if (!data || data.length < PAGE) return rows
      }
    },
  })

  const liveQuery = useQuery({
    queryKey: rhythmKeys.live(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<RhythmEntry[]> => {
      const { data, error } = await supabase
        .from('rhythm_entries')
        .select(WITH_MARKS)
        .eq('user_id', user!.id)
        .is('ended_at', null)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(sortMarks)
    },
  })

  // All-time busiest days, counted on the server in this browser's time zone.
  const peaks = useQuery({
    queryKey: rhythmKeys.peaks(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<RhythmPeak[]> => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const { data, error } = await supabase.rpc('rhythm_peaks', { tz })
      if (error) throw error
      return data ?? []
    },
  })

  const all = entries.data ?? []
  // The window's copy wins: it is the one optimistic edits (start, stop) are applied to first.
  const windowIds = new Set(all.map(e => e.id))
  const live = liveEntries([...all, ...(liveQuery.data ?? []).filter(e => !windowIds.has(e.id))])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: rhythmKeys.all(user?.id) })

  /** Optimistically applies `change` to every cached entry list; returns a rollback. */
  async function patchCache(change: (old: RhythmEntry[]) => RhythmEntry[]) {
    const prefix = rhythmKeys.entries(user?.id)
    await queryClient.cancelQueries({ queryKey: prefix })
    const previous = queryClient.getQueriesData<RhythmEntry[]>({ queryKey: prefix })
    queryClient.setQueriesData<RhythmEntry[]>({ queryKey: prefix }, old => (old ? change(old) : old))
    return () => previous.forEach(([k, data]: [QueryKey, RhythmEntry[] | undefined]) => queryClient.setQueryData(k, data))
  }

  const mapEntry = (id: string, change: (entry: RhythmEntry) => RhythmEntry) => (old: RhythmEntry[]) =>
    old.map(entry => (entry.id === id ? change(entry) : entry))

  // One tap is one moment. It can become a session, and feelings can be added, afterwards.
  const log = useMutation({
    mutationFn: async (input: { activity: RhythmActivityKey; kind: RhythmKind; variant?: string | null; occurred_at: string }): Promise<RhythmEntry> => {
      if (!user) throw new Error('Sign in to keep track.')
      const { data, error } = await supabase
        .from('rhythm_entries')
        .insert({ ...input, variant: input.variant ?? null, ended_at: input.occurred_at, user_id: user.id })
        .select(WITH_MARKS)
        .single()
      if (error) throw error
      return sortMarks(data)
    },
    onMutate: async input => {
      const optimistic: RhythmEntry = {
        id: `temp-${Date.now()}`,
        user_id: user?.id ?? '',
        ...NO_FEELINGS,
        ended_at: input.occurred_at,
        done_note: '',
        tallies: [],
        marks: [],
        created_at: new Date().toISOString(),
        ...input,
        variant: input.variant ?? null,
      }
      // Only the window holds moments; the live list is left alone.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<RhythmEntry[]>(key)
      queryClient.setQueryData<RhythmEntry[]>(key, old => [optimistic, ...(old ?? [])])
      return { tempId: optimistic.id, rollback: () => queryClient.setQueryData(key, previous) }
    },
    onSuccess: (saved, _input, context) => {
      queryClient.setQueryData<RhythmEntry[]>(key, old => old?.map(entry => (entry.id === context.tempId ? saved : entry)))
    },
    onError: (_e, _input, context) => context?.rollback(),
    onSettled: invalidate,
  })

  /**
   * Any change after the tap: feelings and notes, when it started, starting it as a session
   * (`ended_at: null`), ending it with what got done, or reopening it.
   */
  const edit = useMutation({
    mutationFn: async ({ entry, patch }: { entry: RhythmEntry; patch: RhythmPatch }) => {
      if (!user) throw new Error('Sign in to keep track.')
      const ready = preparePatch(entry, patch, Date.now())
      const { error } = await supabase.from('rhythm_entries').update(ready).eq('id', entry.id).eq('user_id', user.id)
      if (error) throw error
    },
    onMutate: async ({ entry, patch }) => {
      // Invalid patches are refused in mutationFn; the cache gets the same normalized values.
      let ready: RhythmPatch = patch
      try {
        ready = preparePatch(entry, patch, Date.now())
      } catch {
        // Leave the cache as asked; the request will report the problem.
      }
      return { rollback: await patchCache(mapEntry(entry.id, e => ({ ...e, ...ready }))) }
    },
    onError: (_e, _input, context) => context?.rollback(),
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Sign in to keep track.')
      const { error } = await supabase.from('rhythm_entries').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onMutate: async id => ({ rollback: await patchCache(old => old.filter(entry => entry.id !== id)) }),
    onError: (_e, _input, context) => context?.rollback(),
    onSettled: invalidate,
  })

  // A note, a level, or both, at a moment during a session.
  const addMark = useMutation({
    mutationFn: async (input: { entry_id: string; level: number | null; note: string; at: string }) => {
      if (!user) throw new Error('Sign in to keep track.')
      validateMark(input)
      const { error } = await supabase.from('rhythm_marks').insert({ ...input, note: input.note.trim(), user_id: user.id })
      if (error) throw error
    },
    onMutate: async input => {
      const mark: RhythmMark = {
        id: `temp-${Date.now()}`,
        user_id: user?.id ?? '',
        created_at: new Date().toISOString(),
        ...input,
        note: input.note.trim(),
      }
      return { rollback: await patchCache(mapEntry(input.entry_id, e => ({ ...e, marks: [...(e.marks ?? []), mark] }))) }
    },
    onError: (_e, _input, context) => context?.rollback(),
    onSettled: invalidate,
  })

  const removeMark = useMutation({
    mutationFn: async ({ id }: { id: string; entry_id: string }) => {
      if (!user) throw new Error('Sign in to keep track.')
      const { error } = await supabase.from('rhythm_marks').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onMutate: async ({ id, entry_id }) => ({
      rollback: await patchCache(mapEntry(entry_id, e => ({ ...e, marks: (e.marks ?? []).filter(m => m.id !== id) }))),
    }),
    onError: (_e, _input, context) => context?.rollback(),
    onSettled: invalidate,
  })

  return { entries, live, liveQuery, peaks, log, edit, remove, addMark, removeMark }
}
