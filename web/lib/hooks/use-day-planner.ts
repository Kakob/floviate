import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase-client'
import { orderBlocks, validateBlock, type DayBlock, type DayBlockInput } from '@/lib/day-scenes'
import { copyDayTo } from '@/lib/day-planner'
import { dayScenesKeys } from '@/lib/hooks/use-day-scenes'

export type SaveBlockInput = DayBlockInput & { id?: string; expectedUpdatedAt?: string; position?: number }

const isBlockList = (key: QueryKey) => key[2] === 'blocks' || key[2] === 'range'

/** Plans for several days at once (a week), in plan order. */
export function useDayRange(dates: string[]) {
  const { user } = useAuth()
  const first = dates[0]
  const last = dates[dates.length - 1]
  return useQuery({
    queryKey: [...dayScenesKeys.all(user?.id), 'range', first, last],
    enabled: !!user && dates.length > 0,
    queryFn: async (): Promise<DayBlock[]> => {
      const { data, error } = await supabase
        .from('day_blocks')
        .select('*')
        .eq('user_id', user!.id)
        .gte('plan_date', first)
        .lte('plan_date', last)
      if (error) throw error
      return orderBlocks(data ?? [])
    },
  })
}

/** Creating, editing, removing, and copying plans. Shared by the scene view and the planner grid. */
export function useDayBlockMutations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const root = dayScenesKeys.all(user?.id)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: root })

  const saveBlock = useMutation({
    mutationFn: async ({ id, expectedUpdatedAt, position, ...input }: SaveBlockInput): Promise<DayBlock> => {
      if (!user) throw new Error('Sign in to save your day.')
      validateBlock(input)
      const query = id
        ? supabase.from('day_blocks').update(input).eq('id', id).eq('user_id', user.id).eq('updated_at', expectedUpdatedAt!)
        : supabase.from('day_blocks').insert({ ...input, position: position ?? 0, user_id: user.id })
      const { data, error } = await query.select().maybeSingle()
      if (error) throw error
      if (!data) throw new Error('This plan changed in another window. Refresh it before editing again.')
      return data
    },
    // Dragging on the grid should feel immediate: move the block in every cached list now.
    onMutate: async ({ id, expectedUpdatedAt: _expected, position: _position, ...input }) => {
      if (!id) return
      await queryClient.cancelQueries({ queryKey: root })
      const snapshots = queryClient.getQueriesData<DayBlock[]>({ queryKey: root, predicate: q => isBlockList(q.queryKey) })
      for (const [key, blocks] of snapshots) {
        if (!blocks) continue
        const moved = blocks.find(b => b.id === id)
        if (!moved) continue
        const updated = { ...moved, ...input }
        // Keep the block visible in a range cache even if it moved to another day in that range.
        queryClient.setQueryData<DayBlock[]>(key, blocks.map(b => (b.id === id ? updated : b)))
      }
      return { snapshots }
    },
    onError: (_error, _input, context) => {
      context?.snapshots.forEach(([key, blocks]) => queryClient.setQueryData(key, blocks))
    },
    onSettled: invalidate,
  })

  // Only plans with nothing recorded against them can be removed; the database enforces this.
  const removeBlocks = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('Sign in to change your day.')
      if (!ids.length) return
      const { data, error } = await supabase.from('day_blocks').delete().in('id', ids).eq('user_id', user.id).select('id')
      if (error) throw error
      if ((data?.length ?? 0) < ids.length) {
        throw new Error('Some plans couldn’t be removed. A plan with check-ins stays, so what you recorded keeps its context. Skip it instead.')
      }
    },
    onSettled: invalidate,
  })

  const insertBlocks = useMutation({
    mutationFn: async (inputs: (DayBlockInput & { position: number })[]): Promise<string[]> => {
      if (!user) throw new Error('Sign in to plan your days.')
      if (!inputs.length) return []
      inputs.forEach(validateBlock)
      const { data, error } = await supabase
        .from('day_blocks')
        .insert(inputs.map(input => ({ ...input, user_id: user.id })))
        .select('id')
      if (error) throw error
      return (data ?? []).map(row => row.id)
    },
    onSettled: invalidate,
  })

  // Copies each source day onto its target days, after whatever is already planned there. Returns new ids for undo.
  const copyDays = useMutation({
    mutationFn: async (copies: { from: DayBlock[]; to: string[] }[]): Promise<string[]> => {
      if (!user) throw new Error('Sign in to plan your days.')
      const targetDates = Array.from(new Set(copies.flatMap(c => c.to)))
      if (!targetDates.length) return []
      const { data: existing, error } = await supabase
        .from('day_blocks')
        .select('plan_date, position')
        .eq('user_id', user.id)
        .in('plan_date', targetDates)
      if (error) throw error
      const next = new Map<string, number>()
      for (const row of existing ?? []) next.set(row.plan_date, Math.max(next.get(row.plan_date) ?? 0, row.position))
      const inputs = copies.flatMap(({ from, to }) =>
        copyDayTo(from, to.map(date => ({ date, nextPosition: (next.get(date) ?? 0) + 1 })))
      )
      return insertBlocks.mutateAsync(inputs)
    },
  })

  return { saveBlock, removeBlocks, insertBlocks, copyDays }
}
