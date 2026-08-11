export type DeckSize = 10 | 13
export type AIDifficulty = 'easy' | 'medium' | 'hard'

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
  vsAI: boolean
  aiDifficulty: AIDifficulty
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
  vsAI = false,
  aiDifficulty: AIDifficulty = 'medium',
): GameState {
  return {
    phase: 'prize-reveal',
    deckSize,
    p1Name: p1Name.trim() || 'Player 1',
    p2Name: vsAI ? 'AI Opponent' : p2Name.trim() || 'Player 2',
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
    vsAI,
    aiDifficulty,
  }
}

/** Picks a uniformly random card from hand — no strategy at all. */
function chooseAIBidEasy(hand: number[]): number {
  return hand[Math.floor(Math.random() * hand.length)]
}

/**
 * Weighs its bid toward the prize's rank among its own remaining cards,
 * with a chance to bluff low on cheap prizes and some jitter so it isn't
 * perfectly predictable. This was the original (and still default)
 * AI behavior.
 */
function chooseAIBidMedium(
  hand: number[],
  prizeValue: number,
  deckSize: number,
): number {
  const sorted = [...hand].sort((a, b) => a - b)
  const lastIdx = sorted.length - 1

  if (prizeValue <= 2 && Math.random() < 0.5) {
    return sorted[0]
  }

  const percentile = prizeValue / deckSize
  const targetIdx = Math.round(percentile * lastIdx)
  const jitter = Math.floor(Math.random() * 3) - 1 // -1, 0, or 1
  const idx = Math.min(lastIdx, Math.max(0, targetIdx + jitter))
  return sorted[idx]
}

/**
 * Plays closer to the equilibrium strategy for Goofspiel: since both
 * hands are fully public (decks are pre-determined), it ranks the
 * current prize against every prize still left in the deck (including
 * itself) rather than a fixed scale, so its bidding adapts as high-
 * or low-value prizes get used up. It spends its highest card outright
 * on the single most valuable prize remaining, otherwise matches the
 * prize's percentile rank in its own hand with minimal randomness —
 * no bluffing, and only rare +/-1 jitter to stay slightly unpredictable.
 */
function chooseAIBidHard(
  hand: number[],
  prizeValue: number,
  remainingPrizes: number[],
): number {
  const sorted = [...hand].sort((a, b) => a - b)
  const lastIdx = sorted.length - 1

  const allRemaining = [prizeValue, ...remainingPrizes]
  if (prizeValue === Math.max(...allRemaining)) {
    return sorted[lastIdx]
  }

  const rank = allRemaining.filter((v) => v <= prizeValue).length
  const percentile = rank / allRemaining.length
  const targetIdx = Math.round(percentile * lastIdx)
  const jitter = Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : 0
  const idx = Math.min(lastIdx, Math.max(0, targetIdx + jitter))
  return sorted[idx]
}

export function chooseAIBid(
  hand: number[],
  prizeValue: number,
  deckSize: number,
  difficulty: AIDifficulty,
  remainingPrizes: number[] = [],
): number {
  switch (difficulty) {
    case 'easy':
      return chooseAIBidEasy(hand)
    case 'hard':
      return chooseAIBidHard(hand, prizeValue, remainingPrizes)
    case 'medium':
    default:
      return chooseAIBidMedium(hand, prizeValue, deckSize)
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
  const afterP1: GameState = {
    ...state,
    p1Bid: bid,
    p1Hand: state.p1Hand.filter((c) => c !== bid),
    phase: 'pass-to-p2',
  }

  if (state.vsAI) {
    const aiBid = chooseAIBid(
      afterP1.p2Hand,
      state.currentPrize as number,
      state.deckSize,
      state.aiDifficulty,
      state.prizeDeck,
    )
    return submitP2Bid({ ...afterP1, phase: 'p2-bid' }, aiBid)
  }

  return afterP1
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
