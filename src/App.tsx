import { useEffect, useRef, useState } from 'react'
import Card from './Card'
import { cardLabel } from './cardLabel'
import {
  createInitialState,
  flipPrize,
  nextRound,
  proceedToP2,
  submitP1Bid,
  submitP2Bid,
  type AIDifficulty,
  type DeckSize,
  type GameState,
} from './game'
import {
  createRoom,
  joinRoom,
  RoomFullError,
  RoomNotFoundError,
  type OnlineIdentity,
} from './online'

const AI_DIFFICULTIES: { value: AIDifficulty; label: string }[] = [
  { value: 'easy', label: '🙂 Easy' },
  { value: 'medium', label: '😐 Medium' },
  { value: 'hard', label: '😈 Hard' },
]

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

  const deckLocked = mode === 'online' && joinCode.trim().length > 0

  return (
    <div className="setup-page">
      <div className="setup-bg" aria-hidden="true" />
      <div className="setup-stage">
        <div className="setup-heading">
          <p className="setup-eyebrow">Secret bidding, two players</p>
          <h1>GOPS</h1>
        </div>

        <div className="setup-panel">
          {mode === 'online' ? (
            <div className="setup-players">
              <span className="avatar">P1</span>
              <div className="player-field">
                <input
                  value={p1}
                  onChange={(e) => setP1(e.target.value)}
                  placeholder="Your name"
                  maxLength={20}
                />
              </div>
            </div>
          ) : (
            <div className="setup-players">
              <span className="avatar">P1</span>
              <div className="player-field">
                <input
                  value={p1}
                  onChange={(e) => setP1(e.target.value)}
                  placeholder="Player 1"
                  maxLength={20}
                />
              </div>
              <span className="vs">VS</span>
              {mode === 'ai' ? (
                <span className="avatar avatar--ai">AI</span>
              ) : (
                <>
                  <div className="player-field">
                    <input
                      value={p2}
                      onChange={(e) => setP2(e.target.value)}
                      placeholder="Player 2"
                      maxLength={20}
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                  <span className="avatar">P2</span>
                </>
              )}
            </div>
          )}

          <div className="setup-hand" aria-hidden="true">
            <Card value={7} suit="♠" size="sm" />
            <Card value={12} suit="♥" size="sm" />
            <Card value={11} suit="♣" size="sm" />
            <Card value={0} faceDown size="sm" />
            <Card value={0} faceDown size="sm" />
          </div>

          <div className="field-group">
            <span className="field-label">Opponent</span>
            <div className="pill-row">
              <button
                className={mode === 'local' ? 'pill pill--active' : 'pill'}
                onClick={() => setMode('local')}
              >
                2 Players
              </button>
              <button
                className={mode === 'ai' ? 'pill pill--active' : 'pill'}
                onClick={() => setMode('ai')}
              >
                vs AI
              </button>
              <button
                className={mode === 'online' ? 'pill pill--active' : 'pill'}
                onClick={() => setMode('online')}
              >
                Online
              </button>
            </div>
          </div>

          {mode === 'online' && (
            <div className="field-group">
              <span className="field-label">Join code (leave blank to create a room)</span>
              <input
                className="text-input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Room code"
                maxLength={5}
              />
            </div>
          )}

          {mode === 'ai' && (
            <div className="field-group">
              <span className="field-label">AI difficulty</span>
              <div className="pill-row">
                {AI_DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    className={aiDifficulty === d.value ? 'pill pill--active' : 'pill'}
                    onClick={() => setAiDifficulty(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field-group">
            <span className="field-label">Deck</span>
            <div className="pill-row">
              <button
                className={deckSize === 10 ? 'pill pill--active' : 'pill'}
                onClick={() => setDeckSize(10)}
                disabled={deckLocked}
              >
                A–10
              </button>
              <button
                className={deckSize === 13 ? 'pill pill--active' : 'pill'}
                onClick={() => setDeckSize(13)}
                disabled={deckLocked}
              >
                A–K
              </button>
            </div>
          </div>

          {onlineError && <p className="setup-online-error">{onlineError}</p>}

          {mode === 'online' ? (
            <button
              className="cta"
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
              className="cta"
              onClick={() => onStart(deckSize, p1, p2, mode === 'ai', aiDifficulty)}
            >
              Start game
            </button>
          )}
        </div>

        <details className="setup-rules">
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
    </div>
  )
}

function PrizeRevealScreen({
  state,
  onFlip,
}: {
  state: GameState
  onFlip: () => void
}) {
  const roundNum = state.deckSize - state.prizeDeck.length + 1
  return (
    <div className="screen center">
      <p className="round-label">Round {roundNum} / {state.deckSize}</p>
      <Scoreboard state={state} />
      <p className="prompt">Flip the next prize card</p>
      <Card value={0} faceDown size="lg" onClick={onFlip} />
      {state.pot > 0 && (
        <p className="pot-note">🤝 {state.pot} points carried over from a tie!</p>
      )}
    </div>
  )
}

function BidScreen({
  state,
  who,
  onSubmit,
}: {
  state: GameState
  who: 'p1' | 'p2'
  onSubmit: (bid: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const name = who === 'p1' ? state.p1Name : state.p2Name
  const hand = who === 'p1' ? state.p1Hand : state.p2Hand
  const suit = who === 'p1' ? '♥' : '♦'

  return (
    <div className="screen center">
      <p className="round-label">{name}'s turn to bid</p>
      <div className="prize-display">
        <span>Prize on the table</span>
        <Card value={state.currentPrize ?? 0} suit="♠" size="md" />
        {state.pot > 0 && <span className="pot-note">+ {state.pot} carried over</span>}
      </div>
      <p className="prompt">Choose a card to bid (secretly)</p>
      <div className="hand">
        {hand.map((c) => (
          <Card
            key={c}
            value={c}
            suit={suit}
            size="sm"
            selected={selected === c}
            dimmed={selected !== null && selected !== c}
            onClick={() => setSelected(c)}
          />
        ))}
      </div>
      <button
        className="btn btn--primary btn--big"
        disabled={selected === null}
        onClick={() => selected !== null && onSubmit(selected)}
      >
        Lock In Bid
      </button>
    </div>
  )
}

function PassScreen({
  nextPlayerName,
  onReady,
}: {
  nextPlayerName: string
  onReady: () => void
}) {
  return (
    <div className="screen center">
      <p className="pass-icon">🔄</p>
      <h2>Pass the device to</h2>
      <h1 className="pass-name">{nextPlayerName}</h1>
      <p className="prompt">Don't peek! 🙈</p>
      <button className="btn btn--primary btn--big" onClick={onReady}>
        I'm Ready
      </button>
    </div>
  )
}

function RevealScreen({
  state,
  onNext,
}: {
  state: GameState
  onNext: () => void
}) {
  const last = state.history[state.history.length - 1]
  const winnerName =
    last.winner === 'p1'
      ? state.p1Name
      : last.winner === 'p2'
        ? state.p2Name
        : null

  return (
    <div className="screen center">
      {winnerName && <Confetti />}
      <p className="round-label">Reveal!</p>
      <div className="reveal-row">
        <div className="reveal-col">
          <span>{state.p1Name}</span>
          <Card value={last.p1Bid} suit="♥" size="md" flipReveal />
        </div>
        <div className="reveal-vs">vs</div>
        <div className="reveal-col">
          <span>{state.p2Name}</span>
          <Card value={last.p2Bid} suit="♦" size="md" flipReveal />
        </div>
      </div>
      <p className="prize-note">
        Prize: {cardLabel(last.prizeValue)} ({last.prizeValue} pts)
      </p>
      {winnerName ? (
        <p className="winner-banner winner-banner--pop">🏆 {winnerName} wins this round!</p>
      ) : (
        <p className="winner-banner tie">🤝 Tie! Prize carries over.</p>
      )}
      <Scoreboard state={state} />
      <button className="btn btn--primary btn--big" onClick={onNext}>
        {state.prizeDeck.length === 0 ? 'See Final Score' : 'Next Round'}
      </button>
    </div>
  )
}

const CONFETTI_EMOJI = ['🎉', '✨', '🎊', '⭐']

function Confetti() {
  const pieces = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 0.9 + Math.random() * 0.6,
    emoji: CONFETTI_EMOJI[i % CONFETTI_EMOJI.length],
  }))

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti__piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}

function GameOverScreen({
  state,
  onRestart,
}: {
  state: GameState
  onRestart: () => void
}) {
  const winner =
    state.p1Score > state.p2Score
      ? state.p1Name
      : state.p2Score > state.p1Score
        ? state.p2Name
        : null

  return (
    <div className="screen center">
      <p className="pass-icon">🏁</p>
      <h1>Game Over</h1>
      {winner ? (
        <h2 className="winner-banner">🎉 {winner} wins the game!</h2>
      ) : (
        <h2 className="winner-banner tie">🤝 It's a tie!</h2>
      )}
      <Scoreboard state={state} big />
      <button className="btn btn--primary btn--big" onClick={onRestart}>
        Play Again
      </button>
    </div>
  )
}

function useScoreBump(score: number) {
  const [bump, setBump] = useState(false)
  const prev = useRef(score)

  useEffect(() => {
    if (score !== prev.current) {
      prev.current = score
      setBump(true)
      const t = setTimeout(() => setBump(false), 450)
      return () => clearTimeout(t)
    }
  }, [score])

  return bump
}

function Scoreboard({ state, big = false }: { state: GameState; big?: boolean }) {
  const p1Bump = useScoreBump(state.p1Score)
  const p2Bump = useScoreBump(state.p2Score)

  return (
    <div className={big ? 'scoreboard scoreboard--big' : 'scoreboard'}>
      <div className="score">
        <span className="score__name">{state.p1Name}</span>
        <span className={p1Bump ? 'score__value score__value--bump' : 'score__value'}>
          {state.p1Score}
        </span>
      </div>
      <div className="score">
        <span className="score__name">{state.p2Name}</span>
        <span className={p2Bump ? 'score__value score__value--bump' : 'score__value'}>
          {state.p2Score}
        </span>
      </div>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null)

  if (!state) {
    return (
      <SetupScreen
        onStart={(deckSize, p1, p2, vsAI, aiDifficulty) =>
          setState(createInitialState(deckSize, p1, p2, vsAI, aiDifficulty))
        }
      />
    )
  }

  switch (state.phase) {
    case 'prize-reveal':
      return (
        <PrizeRevealScreen state={state} onFlip={() => setState(flipPrize(state))} />
      )
    case 'p1-bid':
      return (
        <BidScreen
          state={state}
          who="p1"
          onSubmit={(bid) => setState(submitP1Bid(state, bid))}
        />
      )
    case 'pass-to-p2':
      return (
        <PassScreen
          nextPlayerName={state.p2Name}
          onReady={() => setState(proceedToP2(state))}
        />
      )
    case 'p2-bid':
      return (
        <BidScreen
          state={state}
          who="p2"
          onSubmit={(bid) => setState(submitP2Bid(state, bid))}
        />
      )
    case 'reveal':
      return (
        <RevealScreen state={state} onNext={() => setState(nextRound(state))} />
      )
    case 'game-over':
      return <GameOverScreen state={state} onRestart={() => setState(null)} />
    default:
      return null
  }
}
