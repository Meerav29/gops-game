import { cardLabel } from './cardLabel'

interface CardProps {
  value: number
  suit?: string
  faceDown?: boolean
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  dimmed?: boolean
  flipReveal?: boolean
  onClick?: () => void
}

export default function Card({
  value,
  suit = '♠',
  faceDown = false,
  size = 'md',
  selected = false,
  dimmed = false,
  flipReveal = false,
  onClick,
}: CardProps) {
  const classes = [
    'card',
    `card--${size}`,
    flipReveal ? 'card--flip-reveal' : 'card--enter',
    faceDown ? 'card--back' : '',
    selected ? 'card--selected' : '',
    dimmed ? 'card--dimmed' : '',
    onClick ? 'card--clickable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (faceDown) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={!onClick} />
    )
  }

  const isRed = suit === '♥' || suit === '♦'

  return (
    <button
      type="button"
      className={classes + (isRed ? ' card--red' : ' card--black')}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="card__value">{cardLabel(value)}</span>
      <span className="card__suit">{suit}</span>
    </button>
  )
}
