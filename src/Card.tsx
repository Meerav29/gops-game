import { cardLabel } from './cardLabel'

interface CardProps {
  value: number
  suit?: string
  faceDown?: boolean
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
}

export default function Card({
  value,
  suit = '♠',
  faceDown = false,
  size = 'md',
  selected = false,
  dimmed = false,
  onClick,
}: CardProps) {
  const classes = [
    'card',
    `card--${size}`,
    faceDown ? 'card--back' : '',
    selected ? 'card--selected' : '',
    dimmed ? 'card--dimmed' : '',
    onClick ? 'card--clickable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (faceDown) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        disabled={!onClick}
      >
        <span className="card__pattern">✦</span>
      </button>
    )
  }

  const isRed = suit === '♥' || suit === '♦'

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={!onClick}
      style={{ color: isRed ? '#e0446b' : '#1f2430' }}
    >
      <span className="card__corner card__corner--tl">
        {cardLabel(value)}
        <br />
        {suit}
      </span>
      <span className="card__center">{suit}</span>
      <span className="card__corner card__corner--br">
        {cardLabel(value)}
        <br />
        {suit}
      </span>
    </button>
  )
}
