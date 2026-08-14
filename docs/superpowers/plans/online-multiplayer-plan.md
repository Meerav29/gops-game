# Online Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Online" opponent mode so two players on separate
devices can play a live GOPS game over the internet, via a Supabase
Postgres row (`rooms` table) as shared state, synced through Supabase
Realtime.

**Architecture:** A new `src/online.ts` module wraps a Supabase client:
create/join a room, subscribe to its row for live updates, and write
state back after every action. `src/game.ts`'s existing pure reducer
functions (`flipPrize`, `submitP1Bid`, `submitP2Bid`, `nextRound`) are
reused unchanged — online mode just calls them and persists the result
to Supabase instead of local `useState`. `src/App.tsx` gains a new
opponent mode branch that sources `GameState` from a Realtime
subscription and dispatches actions through the same reducer calls.

**Tech Stack:** Vite + React + TypeScript (existing), `@supabase/supabase-js`
(new), Vitest (new, for `online.ts` unit tests — no test framework exists
in this repo yet).

## Global Constraints

- No changes to `src/game.ts` — the reducer is reused as-is (spec: "Reuse
  the existing pure reducer in `src/game.ts` unchanged").
- No accounts/auth. Room code is the only access control (spec non-goal).
- No cheat-prevention — bids are visible in the shared row pre-reveal;
  this is accepted, not a bug to fix (spec non-goal).
- No disconnect timeouts/forfeits — a room just waits indefinitely
  (spec non-goal).
- No public lobby — rooms are only joinable via direct code/link (spec
  non-goal).
- Local hot-seat and vs-AI modes must continue to work exactly as they
  do today, fully offline.
- Supabase project URL + anon key are public client-side config (not
  secrets) — this is expected Supabase usage, access control is via
  row-level security, not key secrecy.

---

### Task 1: Add Vitest test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts` (add `test` block) — modify existing file
- Create: `src/vitest-setup.ts` (empty placeholder not needed — skip;
  no DOM tests planned here)

**Interfaces:**
- Produces: `npm run test` script; `vitest` importable in `*.test.ts`
  files under `src/`.

- [ ] **Step 1: Install Vitest**

Run:

```bash
npm install -D vitest
```

- [ ] **Step 2: Add a `test` script to `package.json`**

Modify `package.json` scripts block to:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "test": "vitest run"
},
```

- [ ] **Step 3: Add a `test` config block to `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Write a trivial smoke test to verify the runner works**

Create `src/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the test suite and verify it passes**

Run: `npm run test`
Expected: 1 passed (1 test)

- [ ] **Step 6: Delete the smoke test (its only purpose was verifying the runner)**

Run:

```bash
rm src/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "Add Vitest test infrastructure"
```

---

### Task 2: Supabase project setup and client module

**Files:**
- Create: `src/supabaseClient.ts`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env` and `.env.local` are ignored)
- Create: `supabase/migration.sql` (documentation of the schema to run
  in the Supabase SQL editor — this repo has no Supabase CLI/migration
  tooling, so this is a plain SQL file the human runs manually)

**Interfaces:**
- Produces: `supabase` — a configured `SupabaseClient` instance,
  exported from `src/supabaseClient.ts`, for `src/online.ts` (Task 3)
  to import.

- [ ] **Step 1: Install the Supabase JS client**

Run:

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Check `.gitignore` for env file entries, add if missing**

Read `.gitignore`. If it does not already contain `.env` and
`.env.local` entries, append:

```
.env
.env.local
```

- [ ] **Step 3: Create `.env.example` documenting the required variables**

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: Write the Supabase schema as a plain SQL file**

Create `supabase/migration.sql`:

```sql
create table if not exists rooms (
  code text primary key,
  state jsonb not null,
  player_ids jsonb not null default '{"p1": null, "p2": null}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table rooms enable row level security;

create policy "public read" on rooms
  for select using (true);

create policy "public insert" on rooms
  for insert with check (true);

create policy "public update" on rooms
  for update using (true);

alter publication supabase_realtime add table rooms;
```

- [ ] **Step 5: Create the Supabase client module**

Create `src/supabaseClient.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 6: Human sets up the actual Supabase project (manual, not scriptable)**

This step is performed by the user, not the agent:
1. Create a free project at https://supabase.com.
2. In the SQL editor, run the contents of `supabase/migration.sql`.
3. Copy the Project URL and anon public key from Project Settings → API.
4. Create `.env.local` in the repo root (git-ignored) with:
   ```
   VITE_SUPABASE_URL=<project-url>
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```

- [ ] **Step 7: Verify the app still builds with the new env var check**

Run: `npm run build`
Expected: build fails with the "Missing VITE_SUPABASE_URL" error if
`.env.local` isn't set up yet (expected at this point — confirms the
guard works), or succeeds if the human already completed Step 6.
Note in commit message which case applied; do not treat a missing-env
failure here as a task failure, it's the intended guard.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example supabase/migration.sql src/supabaseClient.ts
git commit -m "Add Supabase client module and schema"
```

---

### Task 3: `online.ts` — room create/join

**Files:**
- Create: `src/online.ts`
- Test: `src/online.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/supabaseClient.ts` (Task 2);
  `createInitialState`, `type GameState`, `type DeckSize`,
  `type AIDifficulty` from `src/game.ts`.
- Produces (for Task 4 and `App.tsx` Task 5/6):
  - `type Seat = 'p1' | 'p2'`
  - `type OnlineIdentity = { roomCode: string; playerId: string; seat: Seat }`
  - `generateRoomCode(): string`
  - `generatePlayerId(): string`
  - `createRoom(deckSize: DeckSize, p1Name: string): Promise<OnlineIdentity>`
  - `joinRoom(roomCode: string, p2Name: string): Promise<OnlineIdentity>`
  - `class RoomNotFoundError extends Error`
  - `class RoomFullError extends Error`

- [ ] **Step 1: Write failing tests for `generateRoomCode` and `generatePlayerId`**

Create `src/online.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — `src/online.ts` does not exist / exports not found

- [ ] **Step 3: Implement `generateRoomCode` and `generatePlayerId`**

Create `src/online.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS (both `generateRoomCode` and `generatePlayerId` tests)

- [ ] **Step 5: Write failing tests for `createRoom` and `joinRoom` against a mocked Supabase client**

Add to `src/online.test.ts`:

```typescript
import { vi, beforeEach } from 'vitest'

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
```

- [ ] **Step 6: Run tests to verify the new ones fail**

Run: `npm run test`
Expected: FAIL — `createRoom`/`joinRoom` not exported yet

- [ ] **Step 7: Implement `createRoom` and `joinRoom`**

Append to `src/online.ts`:

```typescript
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
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS — all `online.test.ts` tests green

- [ ] **Step 9: Commit**

```bash
git add src/online.ts src/online.test.ts
git commit -m "Add online.ts room create/join with Supabase backing"
```

---

### Task 4: `online.ts` — subscribe and write-state helpers

**Files:**
- Modify: `src/online.ts`
- Test: `src/online.test.ts`

**Interfaces:**
- Consumes: `OnlineIdentity`, `RoomRow` (internal) from Task 3;
  `supabase` from `src/supabaseClient.ts`.
- Produces (for `App.tsx` Task 6):
  - `subscribeToRoom(roomCode: string, onUpdate: (state: GameState) => void): () => void`
    (returns an unsubscribe function — Task 6 Step 1 extends this
    signature to add a `RoomUpdate` payload and a connection-status
    callback; this task's version is an intermediate step, not the
    final API)
  - `writeRoomState(roomCode: string, state: GameState): Promise<void>`

- [ ] **Step 1: Write a failing test for `writeRoomState`**

Add to `src/online.test.ts`:

```typescript
describe('writeRoomState', () => {
  it('persists a new state blob to the room row', async () => {
    const { createRoom, writeRoomState } = await import('./online')
    const created = await createRoom(13, 'Alice')
    const { __supabaseTestState } = await import('./supabaseClient')
    const nextState = { ...(__supabaseTestState as any).rows.get(created.roomCode).state, p1Score: 3 }

    await writeRoomState(created.roomCode, nextState)

    const row = (__supabaseTestState as any).rows.get(created.roomCode)
    expect(row.state.p1Score).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npm run test`
Expected: FAIL — `writeRoomState` not exported yet

- [ ] **Step 3: Implement `writeRoomState`**

Append to `src/online.ts`:

```typescript
export async function writeRoomState(roomCode: string, state: GameState): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ state, updated_at: new Date().toISOString() })
    .eq('code', roomCode)
    .select()
    .single()

  if (error) throw error
}
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Implement `subscribeToRoom` (no unit test — thin wrapper over Supabase Realtime channel API, verified in Task 8 end-to-end pass)**

Append to `src/online.ts`:

```typescript
export function subscribeToRoom(
  roomCode: string,
  onUpdate: (state: GameState) => void,
): () => void {
  const channel = supabase
    .channel(`room:${roomCode}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
      (payload) => {
        const row = payload.new as RoomRow
        onUpdate(row.state)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
```

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npm run test`
Expected: PASS — all tests in `src/online.test.ts` green

- [ ] **Step 7: Commit**

```bash
git add src/online.ts src/online.test.ts
git commit -m "Add online.ts room subscribe/write-state helpers"
```

---

### Task 5: Setup screen — Online mode selection and create/join sub-flow

**Files:**
- Modify: `src/App.tsx` (`SetupScreen` function, and add a new
  `OnlineJoinScreen` — actually fold into `SetupScreen`'s conditional
  rendering, see below)

**Interfaces:**
- Consumes: `createRoom`, `joinRoom`, `RoomNotFoundError`, `RoomFullError`,
  `type OnlineIdentity` from `src/online.ts` (Task 3).
- Produces: `SetupScreen` calls a new `onStartOnline: (identity:
  OnlineIdentity) => void` prop (in addition to the existing `onStart`
  prop for local/AI modes) when online room creation/join succeeds.

This task only touches `SetupScreen`; wiring `onStartOnline` into
`App`'s top-level state happens in Task 6.

- [ ] **Step 1: Extend `SetupScreen`'s opponent choice to a 3-way mode, with online create/join sub-UI**

Modify `src/App.tsx`. Replace the `SetupScreen` function (currently
lines 22–140) with:

```typescript
type OpponentMode = 'local' | 'ai' | 'online'

function SetupScreen({
  onStart,
  onStartOnline,
}: {
  onStart: (
    deckSize: DeckSize,
    p1: string,
    p2: string,
    vsAI: boolean,
    aiDifficulty: AIDifficulty,
  ) => void
  onStartOnline: (identity: OnlineIdentity) => void
}) {
  const [deckSize, setDeckSize] = useState<DeckSize>(13)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [mode, setMode] = useState<OpponentMode>('local')
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium')
  const [joinCode, setJoinCode] = useState('')
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [onlineBusy, setOnlineBusy] = useState(false)

  async function handleCreateRoom() {
    setOnlineError(null)
    setOnlineBusy(true)
    try {
      const identity = await createRoom(deckSize, p1)
      onStartOnline(identity)
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setOnlineBusy(false)
    }
  }

  async function handleJoinRoom() {
    setOnlineError(null)
    setOnlineBusy(true)
    try {
      const identity = await joinRoom(joinCode.trim().toUpperCase(), p1)
      onStartOnline(identity)
    } catch (err) {
      if (err instanceof RoomNotFoundError) {
        setOnlineError('No room found with that code.')
      } else if (err instanceof RoomFullError) {
        setOnlineError('That room already has two players.')
      } else {
        setOnlineError(err instanceof Error ? err.message : 'Failed to join room')
      }
    } finally {
      setOnlineBusy(false)
    }
  }

  return (
    <div className="screen setup">
      <h1>
        GOPS <span className="subtitle">Game of Pure Strategy</span>
      </h1>
      <p className="tagline">No luck after the flip. Just mind games.</p>

      <div className="setup__field">
        <label>Opponent</label>
        <div className="deck-choice">
          <button
            className={mode === 'local' ? 'chip chip--active' : 'chip'}
            onClick={() => setMode('local')}
          >
            2 Players
          </button>
          <button
            className={mode === 'ai' ? 'chip chip--active' : 'chip'}
            onClick={() => setMode('ai')}
          >
            vs AI
          </button>
          <button
            className={mode === 'online' ? 'chip chip--active' : 'chip'}
            onClick={() => setMode('online')}
          >
            Online
          </button>
        </div>
      </div>

      {mode === 'ai' && (
        <div className="setup__field">
          <label>AI difficulty</label>
          <div className="deck-choice">
            {AI_DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                className={aiDifficulty === d.value ? 'chip chip--active' : 'chip'}
                onClick={() => setAiDifficulty(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="setup__field">
        <label>{mode === 'online' ? 'Your name' : 'Player 1 name'}</label>
        <input
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          placeholder="Player 1"
          maxLength={20}
        />
      </div>
      {mode === 'local' && (
        <div className="setup__field">
          <label>Player 2 name</label>
          <input
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            placeholder="Player 2"
            maxLength={20}
          />
        </div>
      )}

      {mode === 'online' && (
        <div className="setup__field">
          <label>Join an existing room (leave blank to create a new one)</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Room code"
            maxLength={5}
          />
        </div>
      )}

      <div className="setup__field">
        <label>Game length</label>
        <div className="deck-choice">
          <button
            className={deckSize === 10 ? 'chip chip--active' : 'chip'}
            onClick={() => setDeckSize(10)}
            disabled={mode === 'online' && joinCode.trim().length > 0}
          >
            A–10 (short)
          </button>
          <button
            className={deckSize === 13 ? 'chip chip--active' : 'chip'}
            onClick={() => setDeckSize(13)}
            disabled={mode === 'online' && joinCode.trim().length > 0}
          >
            A–K (full)
          </button>
        </div>
      </div>

      {onlineError && <p className="online-error">{onlineError}</p>}

      {mode === 'online' ? (
        <button
          className="btn btn--primary btn--big"
          disabled={onlineBusy}
          onClick={joinCode.trim() ? handleJoinRoom : handleCreateRoom}
        >
          {onlineBusy
            ? 'Please wait…'
            : joinCode.trim()
              ? 'Join Room'
              : 'Create Room'}
        </button>
      ) : (
        <button
          className="btn btn--primary btn--big"
          onClick={() => onStart(deckSize, p1, p2, mode === 'ai', aiDifficulty)}
        >
          Start Game
        </button>
      )}

      <details className="rules">
        <summary>How to play</summary>
        <ul>
          <li>Each player holds the same set of cards (Ace–{deckSize === 13 ? 'King' : '10'}).</li>
          <li>Each round, a prize card is flipped face up.</li>
          <li>Both players secretly pick one card from their hand to bid.</li>
          <li>Highest bid wins the prize card's value as points.</li>
          <li>Ties carry the prize over to the next round.</li>
          <li>Every card can only be used once. Highest total score wins!</li>
        </ul>
      </details>
    </div>
  )
}
```

Note: `deckSize` is disabled once a join code is entered because the
room's deck size is decided by whoever created it (Task 3's `createRoom`
already bakes `deckSize` into the initial state; joining doesn't
re-negotiate it).

- [ ] **Step 2: Add the new imports this requires**

Modify the top of `src/App.tsx` (the existing import block, lines 1–14)
to add:

```typescript
import {
  createRoom,
  joinRoom,
  RoomFullError,
  RoomNotFoundError,
  type OnlineIdentity,
} from './online'
```

- [ ] **Step 3: Verify the project still type-checks (App's call site isn't updated yet, so this will show an error at the `<SetupScreen>` usage — expected, fixed in Task 6)**

Run: `npx tsc -b --noEmit`
Expected: error only at the `SetupScreen` call site in `App` (missing
`onStartOnline` prop) — confirms the component itself compiles

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "Add Online mode selection and create/join UI to setup screen"
```

---

### Task 6: Online game loop — waiting screen, subscription-driven state, dispatch

**Files:**
- Modify: `src/App.tsx` (add `RoomWaitingScreen`, `WaitingOnOpponentScreen`,
  add online branch to `App`)
- Modify: `src/online.ts` (`subscribeToRoom` gains a `RoomUpdate` payload
  and a connection-status callback)
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `writeRoomState` from `src/online.ts` (Task 4);
  `flipPrize`, `submitP1Bid`, `submitP2Bid`, `nextRound`, `type
  GameState` from `src/game.ts`; `onStartOnline` prop added to
  `SetupScreen` in Task 5.
- Modifies `subscribeToRoom`'s signature from Task 4 to:
  `subscribeToRoom(roomCode: string, onUpdate: (update: RoomUpdate) =>
  void, onStatusChange?: (status: 'connected' | 'reconnecting') =>
  void): () => void`
- Produces (for Task 7): `type RoomUpdate = { state: GameState;
  playerIds: { p1: string | null; p2: string | null } }`, exported
  from `src/online.ts`; a fully playable online mode reachable from
  `App`.

- [ ] **Step 1: Update `subscribeToRoom` to report the full room row and connection status**

Modify `src/online.ts`. Replace the `subscribeToRoom` function added in
Task 4, Step 5, with:

```typescript
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
```

This is a signature change from Task 4's version (which only took
`onUpdate: (state: GameState) => void`). No test in `src/online.test.ts`
calls `subscribeToRoom` directly (per Task 4, it was left untested there
since it's a thin Realtime wrapper, verified manually in Task 8), so no
test changes are needed here.

- [ ] **Step 2: Run the test suite to confirm the signature change didn't break anything**

Run: `npm run test`
Expected: PASS — unaffected, since no test calls `subscribeToRoom`

- [ ] **Step 3: Add the `RoomWaitingScreen` and `WaitingOnOpponentScreen` components**

Add to `src/App.tsx`, near the other screen components (after
`PassScreen`, before `RevealScreen`):

```typescript
function RoomWaitingScreen({ roomCode }: { roomCode: string }) {
  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`
  return (
    <div className="screen center">
      <div className="pass-icon" />
      <h2>Waiting for your opponent…</h2>
      <p className="prompt">Share this code or link</p>
      <p className="pass-name">{roomCode}</p>
      <input
        className="room-link"
        readOnly
        value={joinUrl}
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  )
}

function WaitingOnOpponentScreen({ state }: { state: GameState }) {
  return (
    <div className="screen center">
      <p className="round-label">Waiting for opponent's bid…</p>
      <div className="prize-display">
        <span>Prize on the table</span>
        <Card value={state.currentPrize ?? 0} suit="♠" size="md" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add a `useOnlineGame` hook and wire the online branch into `App`**

Replace the `App` function (currently lines 376–426) with:

```typescript
function useOnlineGame(identity: OnlineIdentity | null) {
  const [update, setUpdate] = useState<RoomUpdate | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting'>('connected')

  useEffect(() => {
    if (!identity) return
    const unsubscribe = subscribeToRoom(identity.roomCode, setUpdate, setConnectionStatus)
    return unsubscribe
  }, [identity])

  return { update, connectionStatus }
}

export default function App() {
  const [localState, setLocalState] = useState<GameState | null>(null)
  const [onlineIdentity, setOnlineIdentity] = useState<OnlineIdentity | null>(null)
  const { update: onlineUpdate, connectionStatus } = useOnlineGame(onlineIdentity)

  if (onlineIdentity) {
    if (!onlineUpdate) {
      return <RoomWaitingScreen roomCode={onlineIdentity.roomCode} />
    }

    const bothJoined = Boolean(onlineUpdate.playerIds.p1 && onlineUpdate.playerIds.p2)
    if (!bothJoined) {
      return <RoomWaitingScreen roomCode={onlineIdentity.roomCode} />
    }

    const onlineState = onlineUpdate.state
    const mySeat = onlineIdentity.seat
    const dispatch = (next: GameState) => writeRoomState(onlineIdentity.roomCode, next)

    let phaseScreen: JSX.Element | null
    switch (onlineState.phase) {
      case 'prize-reveal':
        phaseScreen = (
          <PrizeRevealScreen
            state={onlineState}
            onFlip={() => dispatch(flipPrize(onlineState))}
          />
        )
        break
      case 'p1-bid':
        phaseScreen =
          mySeat !== 'p1' ? (
            <WaitingOnOpponentScreen state={onlineState} />
          ) : (
            <BidScreen
              state={onlineState}
              who="p1"
              onSubmit={(bid) => dispatch(submitP1Bid(onlineState, bid))}
            />
          )
        break
      case 'p2-bid':
        phaseScreen =
          mySeat !== 'p2' ? (
            <WaitingOnOpponentScreen state={onlineState} />
          ) : (
            <BidScreen
              state={onlineState}
              who="p2"
              onSubmit={(bid) => dispatch(submitP2Bid(onlineState, bid))}
            />
          )
        break
      case 'reveal':
        phaseScreen = (
          <RevealScreen state={onlineState} onNext={() => dispatch(nextRound(onlineState))} />
        )
        break
      case 'game-over':
        phaseScreen = (
          <GameOverScreen state={onlineState} onRestart={() => setOnlineIdentity(null)} />
        )
        break
      default:
        phaseScreen = null
    }

    return (
      <>
        {connectionStatus === 'reconnecting' && (
          <div className="connection-banner">Reconnecting…</div>
        )}
        {phaseScreen}
      </>
    )
  }

  if (!localState) {
    return (
      <SetupScreen
        onStart={(deckSize, p1, p2, vsAI, aiDifficulty) =>
          setLocalState(createInitialState(deckSize, p1, p2, vsAI, aiDifficulty))
        }
        onStartOnline={setOnlineIdentity}
      />
    )
  }

  switch (localState.phase) {
    case 'prize-reveal':
      return (
        <PrizeRevealScreen state={localState} onFlip={() => setLocalState(flipPrize(localState))} />
      )
    case 'p1-bid':
      return (
        <BidScreen
          state={localState}
          who="p1"
          onSubmit={(bid) => setLocalState(submitP1Bid(localState, bid))}
        />
      )
    case 'pass-to-p2':
      return (
        <PassScreen
          nextPlayerName={localState.p2Name}
          onReady={() => setLocalState(proceedToP2(localState))}
        />
      )
    case 'p2-bid':
      return (
        <BidScreen
          state={localState}
          who="p2"
          onSubmit={(bid) => setLocalState(submitP2Bid(localState, bid))}
        />
      )
    case 'reveal':
      return (
        <RevealScreen state={localState} onNext={() => setLocalState(nextRound(localState))} />
      )
    case 'game-over':
      return <GameOverScreen state={localState} onRestart={() => setLocalState(null)} />
    default:
      return null
  }
}
```

Note on `bothJoined`: this deliberately reads `onlineUpdate.playerIds`
(the row's `player_ids` column), not `state.p2Name`. `createRoom`
(Task 3) seeds the initial state via `createInitialState(deckSize,
p1Name, '', false, 'medium')`, and `game.ts`'s `createInitialState`
trims an empty `p2` argument to the literal string `'Player 2'` — so
`p2Name` is never actually empty and can't be used as a "has P2
joined" signal. `player_ids.p2` (`null` until `joinRoom` sets it) is
the correct, unambiguous signal.

Note on `GameOverScreen`'s `onRestart` here: this task leaves it as
`() => setOnlineIdentity(null)`. Task 7 modifies this call site again
to also clear the persisted `localStorage` identity — that's expected,
not a mistake to fix now.

- [ ] **Step 5: Add the imports this task needs**

Extend the `from './online'` import in `src/App.tsx` (added in Task 5)
to include the new names:

```typescript
import {
  createRoom,
  joinRoom,
  subscribeToRoom,
  writeRoomState,
  RoomFullError,
  RoomNotFoundError,
  type OnlineIdentity,
  type RoomUpdate,
} from './online'
```

- [ ] **Step 6: Type-check the whole project**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS — all existing tests green

- [ ] **Step 8: Add CSS for the new online-mode elements**

Modify `src/index.css`. Add:

```css
.room-link {
  width: 100%;
  max-width: 320px;
  margin-top: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border, #333);
  background: var(--surface, #1a1a1a);
  color: inherit;
  font-size: 0.85rem;
  text-align: center;
}

.online-error {
  color: #e5484d;
  font-size: 0.85rem;
  margin: 0.25rem 0 0.5rem;
}

.connection-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  text-align: center;
  padding: 0.4rem;
  font-size: 0.8rem;
  background: #b45309;
  color: #fff;
}
```

If `--border` / `--surface` custom properties don't already exist in
`src/index.css`, inspect the file's existing color values (e.g. the
`.setup__field input` rule) and substitute the literal color values
used there instead of the `var(...)` fallbacks, to stay visually
consistent with the rest of the app.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/online.ts src/index.css
git commit -m "Wire up online game loop: waiting screen, live sync, turn-gated bidding, reconnect indicator"
```

---

### Task 7: Reconnect from `localStorage` on page load

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/online.ts`

**Interfaces:**
- Produces: `saveOnlineIdentity(identity: OnlineIdentity): void`,
  `loadOnlineIdentity(): OnlineIdentity | null`,
  `clearOnlineIdentity(): void` in `src/online.ts`.
- Consumes these from `App`'s initial state and `onRestart`/leave-room
  handlers.

- [ ] **Step 1: Write failing tests for the localStorage helpers**

Add to `src/online.test.ts`:

```typescript
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
```

Note: this requires a `localStorage` global. Add `environment: 'jsdom'`
override for this file, or switch the whole suite to jsdom — simplest
is to switch the Vitest environment globally since no test in this repo
needs Node-only APIs.

- [ ] **Step 2: Switch the Vitest environment to jsdom and install it**

Run:

```bash
npm install -D jsdom
```

Modify `vite.config.ts`'s `test` block (from Task 1, Step 3):

```typescript
  test: {
    environment: 'jsdom',
  },
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `npm run test`
Expected: FAIL — `saveOnlineIdentity`/`loadOnlineIdentity`/
`clearOnlineIdentity` not exported yet. Existing tests should still
pass under jsdom.

- [ ] **Step 4: Implement the localStorage helpers**

Append to `src/online.ts`:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS — all tests in `src/online.test.ts` green

- [ ] **Step 6: Wire persistence into `App`'s online flow**

Modify `src/App.tsx`:

1. Initialize `onlineIdentity` state from `loadOnlineIdentity()` instead
   of `null`:
   ```typescript
   const [onlineIdentity, setOnlineIdentity] = useState<OnlineIdentity | null>(
     () => loadOnlineIdentity(),
   )
   ```

2. Save on create/join success — wrap the `onStartOnline` prop passed
   to `SetupScreen` so it persists before setting state:
   ```typescript
   const handleStartOnline = (identity: OnlineIdentity) => {
     saveOnlineIdentity(identity)
     setOnlineIdentity(identity)
   }
   ```
   Pass `onStartOnline={handleStartOnline}` to `<SetupScreen>` instead
   of `onStartOnline={setOnlineIdentity}`.

3. Clear on the online `GameOverScreen`'s restart handler:
   ```typescript
   onRestart={() => {
     clearOnlineIdentity()
     setOnlineIdentity(null)
   }}
   ```

- [ ] **Step 7: Add the new imports**

Extend the `from './online'` import in `src/App.tsx` to include
`saveOnlineIdentity`, `loadOnlineIdentity`, `clearOnlineIdentity`.

- [ ] **Step 8: Type-check and run the full test suite**

Run: `npx tsc -b --noEmit`
Expected: no errors

Run: `npm run test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/online.ts src/online.test.ts vite.config.ts package.json package-lock.json
git commit -m "Persist and restore online room identity via localStorage"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (manual testing task, no code changes expected unless
a bug is found — if so, fix inline and note it in the commit)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the app in two separate browser windows (or one normal + one private/incognito, so `localStorage` doesn't collide)**

- [ ] **Step 3: In window A, select "Online," leave the room code blank, enter a name, click "Create Room"**

Expected: `RoomWaitingScreen` shows a 5-character code and a shareable
link.

- [ ] **Step 4: In window B, select "Online," paste the code from window A, enter a different name, click "Join Room"**

Expected: both windows transition automatically (within ~1s) to the
prize-reveal screen once P2 joins.

- [ ] **Step 5: Play through at least 3 rounds — flip prize, both players bid, confirm reveal shows correct winner and scores update on both windows**

Expected: only the player whose turn it is sees an active `BidScreen`;
the other sees `WaitingOnOpponentScreen`. After both bid, both windows
show the same `RevealScreen` with matching data.

- [ ] **Step 6: Refresh window B mid-game (simulating a disconnect/reconnect)**

Expected: window B reloads back into the same room, at the same phase,
without needing to re-enter the room code (via the `localStorage`
identity from Task 7).

- [ ] **Step 7: Play to game-over in both windows and confirm the final score screen matches, then restart from window A and confirm it returns to setup, not stuck in the old room**

- [ ] **Step 8: Confirm local hot-seat and vs-AI modes still work unaffected**

Run through one quick local hot-seat game and one quick vs-AI game
from the setup screen, confirm no regressions.

- [ ] **Step 9: If any bug was found and fixed during this pass, commit the fix**

```bash
git add -A
git commit -m "Fix issues found during online multiplayer end-to-end testing"
```

(Skip this step if no fixes were needed.)

---

## Post-plan note

Deployment: this plan does not modify `.github/workflows/deploy.yml`.
The existing GitHub Pages deploy workflow builds with `npm run build`,
which will now require `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to
be available at build time (per Task 2's guard in
`src/supabaseClient.ts`). Wiring those as GitHub Actions repository
secrets/variables so the deployed build succeeds is a follow-up step,
intentionally out of scope for this plan (which focuses on local
dev-server-verified functionality per Task 8) — flag this to the user
before merging to `main`.
