import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase-client'
import { useDayBlockMutations } from '@/lib/hooks/use-day-planner'
import {
  dayBounds,
  orderBlocks,
  resolveSelection,
  currentBlock,
  type CheckInKind,
  type DayBlock,
  type DayBlockStatus,
  type DayCheckIn,
  type SceneSelection,
} from '@/lib/day-scenes'

export const dayScenesKeys = {
  all: (userId: string | undefined) => ['day-scenes', userId] as const,
  blocks: (userId: string | undefined, date: string) => ['day-scenes', userId, 'blocks', date] as const,
  logs: (userId: string | undefined, date: string, blockId: string | null) =>
    ['day-scenes', userId, 'logs', date, blockId] as const,
}

export function useDayScenes(date: string, selection: SceneSelection, now: number) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { start, end } = dayBounds(date)

  const blocks = useQuery({
    queryKey: dayScenesKeys.blocks(user?.id, date),
    enabled: !!user,
    queryFn: async (): Promise<DayBlock[]> => {
      const { data, error } = await supabase
        .from('day_blocks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('plan_date', date)
      if (error) throw error
      return orderBlocks(data ?? [])
    },
  })

  const dayBlocks = blocks.data ?? []
  const current = currentBlock(dayBlocks, now)
  const visible = resolveSelection(dayBlocks, selection, now)
  const logsKey = dayScenesKeys.logs(user?.id, date, visible?.id ?? null)

  // A block's check-ins, or the day's check-ins not attached to any plan.
  const logs = useQuery({
    queryKey: logsKey,
    enabled: !!user,
    queryFn: async (): Promise<DayCheckIn[]> => {
      let query = supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', user!.id)
        .not('event_kind', 'is', null)
      query = visible
        ? query.eq('day_block_id', visible.id)
        : query.is('day_block_id', null).gte('created_at', start).lt('created_at', end)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: dayScenesKeys.all(user?.id) })

  const { saveBlock, removeBlocks } = useDayBlockMutations()

  // Done, skip, and restore are explicit user statements; the server records each as history.
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DayBlockStatus }) => {
      if (!user) throw new Error('Sign in to change your day.')
      const { error } = await supabase.from('day_blocks').update({ status }).eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onSettled: invalidate,
  })

  // Moves a block one step in the plan order. Renumbers so legacy equal positions still move.
  const move = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      if (!user) throw new Error('Sign in to change your day.')
      const ordered = orderBlocks(dayBlocks)
      const from = ordered.findIndex(b => b.id === id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= ordered.length) return
      ;[ordered[from], ordered[to]] = [ordered[to], ordered[from]]
      const changed = ordered
        .map((block, index) => ({ block, position: index + 1 }))
        .filter(({ block, position }) => block.position !== position)
      for (const { block, position } of changed) {
        const { error } = await supabase.from('day_blocks').update({ position }).eq('id', block.id).eq('user_id', user.id)
        if (error) throw error
      }
    },
    onSettled: invalidate,
  })

  const checkIn = useMutation({
    mutationFn: async (input: { day_block_id: string | null; event_kind: CheckInKind; value_text: string }) => {
      if (!user) throw new Error('Sign in to save a thought.')
      if (!input.value_text.trim()) throw new Error('Write a thought or describe what changed.')
      // Deliberately no timer, task status, AI, or audio side effects: logging is not coaching.
      const { error } = await supabase.from('log_entries').insert({
        ...input,
        user_id: user.id,
        source: 'manual',
        session_id: null,
        log_type_id: null,
      })
      if (error) throw error
    },
    onMutate: async input => {
      const key = dayScenesKeys.logs(user?.id, date, input.day_block_id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<DayCheckIn[]>(key)
      const optimistic: DayCheckIn = {
        id: `temp-${Date.now()}`,
        day_block_id: input.day_block_id,
        session_id: null,
        event_kind: input.event_kind,
        value_text: input.value_text,
        created_at: new Date().toISOString(),
        plan_snapshot: null,
        previous_plan: null,
      }
      queryClient.setQueryData<DayCheckIn[]>(key, old => [optimistic, ...(old ?? [])])
      return { key, previous }
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: invalidate,
  })

  return { blocks, dayBlocks, logs, current, visible, saveBlock, removeBlocks, setStatus, move, checkIn }
}
