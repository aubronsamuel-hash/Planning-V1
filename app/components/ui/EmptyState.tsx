// ─────────────────────────────────────────────────────────
// EmptyState — État vide réutilisable
// Usage : <EmptyState icon="🎭" title="..." description="..." action={{ label: '...', onClick }} />
// ─────────────────────────────────────────────────────────
import Link from 'next/link'

type EmptyStateAction = {
  label: string
  onClick?: () => void
  href?: string
  variant?: 'primary' | 'ghost'
}

type EmptyStateProps = {
  icon?: string
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-10 px-4' : 'py-16 px-6'
      } ${className}`}
    >
      {icon && (
        <div className={`select-none mb-4 ${compact ? 'text-3xl' : 'text-5xl'}`}>
          {icon}
        </div>
      )}

      <h3 className={`font-semibold text-gray-700 ${compact ? 'text-sm mb-0.5' : 'text-base mb-1'}`}>
        {title}
      </h3>

      {description && (
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed mt-1">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className={`flex items-center gap-3 ${compact ? 'mt-4' : 'mt-5'}`}>
          {action && <ActionButton action={action} />}
          {secondaryAction && <ActionButton action={secondaryAction} />}
        </div>
      )}
    </div>
  )
}

function ActionButton({ action }: { action: EmptyStateAction }) {
  const isPrimary = action.variant !== 'ghost'
  const cls = isPrimary
    ? 'inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors'
    : 'inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors'

  if (action.href) {
    return (
      <Link href={action.href} className={cls}>
        {action.label}
      </Link>
    )
  }

  return (
    <button onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  )
}
