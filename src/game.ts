export type DeckSize = 10 | 13

export interface RoundResult {
  prizeValue: number
  p1Bid: number
  p2Bid: number
  winner: 'p1' | 'p2' | 'tie'
}

export type Phase =
  | 'setup'
  | 'prize-reveal'
  | 'p1-bid'
  | 'pass-to-p2'
  | 'p2-bid'
  | 'reveal'
  | 'game-over'

export interface GameState {
  phase: Phase
  deckSize: DeckSize
  p1Name: string
  p2Name: string
  p1Hand: number[]
  p2Hand: number[]
  prizeDeck: number[]
  currentPrize: number | null
  pot: number
  p1Score: number
  p2Score: number
  p1Bid: number | null
  p2Bid: number | null
  history: RoundResult[]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1)
}

export function createInitialState(
  deckSize: DeckSize,
  p1Name: string,
  p2Name: string,
): GameState {
  return {
    phase: 'prize-reveal',
    deckSize,
    p1Name: p1Name.trim() || 'Player 1',
    p2Name: p2Name.trim() || 'Player 2',
    p1Hand: range(deckSize),
    p2Hand: range(deckSize),
    prizeDeck: shuffle(range(deckSize)),
    currentPrize: null,
    pot: 0,
    p1Score: 0,
    p2Score: 0,
    p1Bid: null,
    p2Bid: null,
    history: [],
  }
}

export function flipPrize(state: GameState): GameState {
  const [next, ...rest] = state.prizeDeck
  return {
    ...state,
    prizeDeck: rest,
    currentPrize: next,
    phase: 'p1-bid',
  }
}

export function submitP1Bid(state: GameState, bid: number): GameState {
  return {
    ...state,
    p1Bid: bid,
    p1Hand: state.p1Hand.filter((c) => c !== bid),
    phase: 'pass-to-p2',
  }
}

export function proceedToP2(state: GameState): GameState {
  return { ...state, phase: 'p2-bid' }
}

export function submitP2Bid(state: GameState, bid: number): GameState {
  const p1Bid = state.p1Bid as number
  const p2Bid = bid
  const prizeValue = state.currentPrize as number
  const potTotal = state.pot + prizeValue

  let winner: 'p1' | 'p2' | 'tie'
  let p1Score = state.p1Score
  let p2Score = state.p2Score
  let pot = 0

  if (p1Bid > p2Bid) {
    winner = 'p1'
    p1Score += potTotal
  } else if (p2Bid > p1Bid) {
    winner = 'p2'
    p2Score += potTotal
  } else {
    winner = 'tie'
    pot = potTotal
  }

  const history = [
    ...state.history,
    { prizeValue, p1Bid, p2Bid, winner },
  ]

  const gameOver = state.prizeDeck.length === 0

  return {
    ...state,
    p2Bid,
    p2Hand: state.p2Hand.filter((c) => c !== bid),
    p1Score,
    p2Score,
    pot,
    history,
    phase: gameOver ? 'game-over' : 'reveal',
  }
}

export function nextRound(state: GameState): GameState {
  return flipPrize({
    ...state,
    currentPrize: null,
    p1Bid: null,
    p2Bid: null,
    phase: 'prize-reveal',
  })
}
