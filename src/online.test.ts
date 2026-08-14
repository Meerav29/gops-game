import { describe, it, expect, vi } from 'vitest'
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
  return {
    __supabaseTestState: state,
    supabase: {
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
    },
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
