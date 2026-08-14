import { supabase } from './supabaseClient'
import { createInitialState, type AIDifficulty, type DeckSize, type GameState } from './game'

export type Seat = 'p1' | 'p2'

export interface OnlineIdentity {
  roomCode: string
  playerId: string
  seat: Seat
}

export class RoomNotFoundError extends Error {
  constructor(roomCode: string) {
    super(`No room found with code "${roomCode}"`)
    this.name = 'RoomNotFoundError'
  }
}

export class RoomFullError extends Error {
  constructor(roomCode: string) {
    super(`Room "${roomCode}" already has two players`)
    this.name = 'RoomFullError'
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function generatePlayerId(): string {
  return crypto.randomUUID()
}

interface RoomRow {
  code: string
  state: GameState
  player_ids: { p1: string | null; p2: string | null }
}

export async function createRoom(
  deckSize: DeckSize,
  p1Name: string,
): Promise<OnlineIdentity> {
  const roomCode = generateRoomCode()
  const playerId = generatePlayerId()
  const initialState = createInitialState(deckSize, p1Name, '', false, 'medium' as AIDifficulty)

  const { error } = await supabase
    .from('rooms')
    .insert({
      code: roomCode,
      state: initialState,
      player_ids: { p1: playerId, p2: null },
    })
    .select()
    .single()

  if (error) throw error

  return { roomCode, playerId, seat: 'p1' }
}

export async function joinRoom(
  roomCode: string,
  p2Name: string,
): Promise<OnlineIdentity> {
  const { data: existing, error: fetchError } = await supabase
    .from('rooms')
    .select()
    .eq('code', roomCode)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!existing) throw new RoomNotFoundError(roomCode)

  const row = existing as RoomRow
  if (row.player_ids.p2) throw new RoomFullError(roomCode)

  const playerId = generatePlayerId()
  const updatedState: GameState = { ...row.state, p2Name: p2Name.trim() || 'Player 2' }

  const { error: updateError } = await supabase
    .from('rooms')
    .update({
      state: updatedState,
      player_ids: { ...row.player_ids, p2: playerId },
    })
    .eq('code', roomCode)
    .select()
    .single()

  if (updateError) throw updateError

  return { roomCode, playerId, seat: 'p2' }
}

export async function writeRoomState(roomCode: string, state: GameState): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ state, updated_at: new Date().toISOString() })
    .eq('code', roomCode)
    .select()
    .single()

  if (error) throw error
}

export interface RoomUpdate {
  state: GameState
  playerIds: { p1: string | null; p2: string | null }
}

export function subscribeToRoom(
  roomCode: string,
  onUpdate: (update: RoomUpdate) => void,
  onStatusChange?: (status: 'connected' | 'reconnecting') => void,
): () => void {
  const channel = supabase
    .channel(`room:${roomCode}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
      (payload) => {
        const row = payload.new as RoomRow
        onUpdate({ state: row.state, playerIds: row.player_ids })
      },
    )
    .subscribe((status) => {
      if (!onStatusChange) return
      onStatusChange(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting')
    })

  return () => {
    supabase.removeChannel(channel)
  }
}

const STORAGE_KEY = 'gops-online-identity'

export function saveOnlineIdentity(identity: OnlineIdentity): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
}

export function loadOnlineIdentity(): OnlineIdentity | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as OnlineIdentity
  } catch {
    return null
  }
}

export function clearOnlineIdentity(): void {
  localStorage.removeItem(STORAGE_KEY)
}
