import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRoomCode, generatePlayerId } from './online'

describe('generateRoomCode', () => {
  it('produces a 5-character uppercase alphanumeric code', () => {
    const code = generateRoomCode()
    expect(code).toMatch(/^[A-Z0-9]{5}$/)
  })

  it('produces different codes across calls (not a constant)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('generatePlayerId', () => {
  it('produces a non-empty unique string per call', () => {
    const a = generatePlayerId()
    const b = generatePlayerId()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(0)
  })
})

vi.mock('./supabaseClient', () => {
  const state = { rows: new Map<string, any>() }
  const mockSupabase = {
    from: (table: string) => {
      if (table !== 'rooms') throw new Error(`unexpected table ${table}`)
      return {
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              state.rows.set(row.code, row)
              return { data: row, error: null }
            },
          }),
        }),
        select: () => ({
          eq: (_col: string, code: string) => ({
            maybeSingle: async () => {
              const row = state.rows.get(code)
              return { data: row ?? null, error: null }
            },
          }),
        }),
        update: (patch: any) => ({
          eq: (_col: string, code: string) => ({
            select: () => ({
              single: async () => {
                const row = state.rows.get(code)
                const updated = { ...row, ...patch }
                state.rows.set(code, updated)
                return { data: updated, error: null }
              },
            }),
          }),
        }),
      }
    },
    channel: () => ({
      on: () => ({
        subscribe: () => {},
      }),
    }),
    removeChannel: () => {},
  }

  return {
    __supabaseTestState: state,
    getSupabase: () => mockSupabase,
  }
})

describe('createRoom', () => {
  it('creates a room and returns a p1 identity', async () => {
    const { createRoom } = await import('./online')
    const identity = await createRoom(13, 'Alice')
    expect(identity.seat).toBe('p1')
    expect(identity.roomCode).toMatch(/^[A-Z0-9]{5}$/)
    expect(identity.playerId.length).toBeGreaterThan(0)
  })
})

describe('joinRoom', () => {
  it('joins an existing room and returns a p2 identity', async () => {
    const { createRoom, joinRoom } = await import('./online')
    const created = await createRoom(13, 'Alice')
    const joined = await joinRoom(created.roomCode, 'Bob')
    expect(joined.seat).toBe('p2')
    expect(joined.roomCode).toBe(created.roomCode)
  })

  it('throws RoomNotFoundError for an unknown code', async () => {
    const { joinRoom, RoomNotFoundError } = await import('./online')
    await expect(joinRoom('ZZZZZ', 'Bob')).rejects.toThrow(RoomNotFoundError)
  })

  it('throws RoomFullError if both seats are taken', async () => {
    const { createRoom, joinRoom, RoomFullError } = await import('./online')
    const created = await createRoom(13, 'Alice')
    await joinRoom(created.roomCode, 'Bob')
    await expect(joinRoom(created.roomCode, 'Carol')).rejects.toThrow(RoomFullError)
  })
})

describe('writeRoomState', () => {
  it('persists a new state blob to the room row', async () => {
    const { createRoom, writeRoomState } = await import('./online')
    const created = await createRoom(13, 'Alice')
    const { __supabaseTestState } = (await import('./supabaseClient')) as unknown as {
      __supabaseTestState: { rows: Map<string, any> }
    }
    const nextState = { ...(__supabaseTestState as any).rows.get(created.roomCode).state, p1Score: 3 }

    await writeRoomState(created.roomCode, nextState)

    const row = (__supabaseTestState as any).rows.get(created.roomCode)
    expect(row.state.p1Score).toBe(3)
  })
})

describe('subscribeToRoom', () => {
  it('fetches the current room row immediately and delivers it via onUpdate', async () => {
    const { createRoom, subscribeToRoom } = await import('./online')
    const created = await createRoom(13, 'Alice')

    const updates: any[] = []
    const unsubscribe = subscribeToRoom(created.roomCode, (update) => updates.push(update))

    // the initial fetch is async; flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(updates).toHaveLength(1)
    expect(updates[0].state.p1Name).toBe('Alice')
    expect(updates[0].playerIds.p1).toBe(created.playerId)

    unsubscribe()
  })

  it('does not call onUpdate when the room does not exist', async () => {
    const { subscribeToRoom } = await import('./online')

    const updates: any[] = []
    const unsubscribe = subscribeToRoom('ZZZZZ', (update) => updates.push(update))

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(updates).toHaveLength(0)
    unsubscribe()
  })
})

describe('online identity persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips an identity through save/load', async () => {
    const { saveOnlineIdentity, loadOnlineIdentity } = await import('./online')
    const identity = { roomCode: 'ABCDE', playerId: 'p-1', seat: 'p1' as const }
    saveOnlineIdentity(identity)
    expect(loadOnlineIdentity()).toEqual(identity)
  })

  it('returns null when nothing is saved', async () => {
    const { loadOnlineIdentity } = await import('./online')
    expect(loadOnlineIdentity()).toBeNull()
  })

  it('clearOnlineIdentity removes the saved identity', async () => {
    const { saveOnlineIdentity, loadOnlineIdentity, clearOnlineIdentity } = await import('./online')
    saveOnlineIdentity({ roomCode: 'ABCDE', playerId: 'p-1', seat: 'p1' })
    clearOnlineIdentity()
    expect(loadOnlineIdentity()).toBeNull()
  })
})
