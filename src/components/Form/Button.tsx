import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning'
  buttonSize?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  loading?: boolean
  iconOnly?: boolean
  children: ReactNode
  asLink?: boolean
  href?: string
}

export function Button({
  variant = 'primary',
  buttonSize = 'medium',
  fullWidth = false,
  loading = false,
  iconOnly = false,
  children,
  className = '',
  disabled,
  asLink = false,
  href,
  ...props
}: ButtonProps) {
  const classes = [
    'form-button',
    `form-button--${variant}`,
    buttonSize === 'small' && 'form-button--small',
    buttonSize === 'large' && 'form-button--large',
    fullWidth && 'form-button--full-width',
    loading && 'form-button--loading',
    iconOnly && 'form-button--icon-only',
    className
  ].filter(Boolean).join(' ')

  if (asLink && href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    )
  }

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {children}
    </button>
  )
}

