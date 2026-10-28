import { Icon } from './Icon'

/**
 * Unified "back one level" control.
 * 44px tall, icon + label, placed in the thumb-reachable left edge.
 */
export function BackButton({ label = '返回', onClick, compact = false }: { label?: string; onClick: () => void; compact?: boolean }) {
  return <button type="button" className={compact ? 'back-button compact' : 'back-button'} onClick={onClick} aria-label={label === '返回' ? '返回上一级' : label}>
    <Icon name="back" size={18}/>
    <span>{label}</span>
  </button>
}
