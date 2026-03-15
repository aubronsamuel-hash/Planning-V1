'use client'
// ─────────────────────────────────────────────────────────
// Button — Composant bouton unifié
// Variants : primary | secondary | ghost | danger
// Sizes    : sm | md | lg
// ─────────────────────────────────────────────────────────
import { forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  children: React.ReactNode
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:   'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border-transparent',
  secondary: 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300',
  ghost:     'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-600 border-transparent',
  danger:    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-transparent',
}

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-2 rounded-lg',
  lg: 'text-sm px-5 py-2.5 rounded-xl',
}

function Spinner({ size }: { size: ButtonSize }) {
  const s = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  return (
    <svg className={`animate-spin flex-shrink-0 ${s}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant  = 'primary',
      size     = 'md',
      loading  = false,
      disabled,
      leftIcon,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center gap-2 font-medium border',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className,
        ].join(' ')}
        {...props}
      >
        {loading ? <Spinner size={size} /> : leftIcon}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
