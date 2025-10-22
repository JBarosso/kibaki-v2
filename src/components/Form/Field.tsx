import { ReactNode } from 'react'

interface FieldProps {
  label?: string
  error?: string
  helper?: string
  required?: boolean
  horizontal?: boolean
  children: ReactNode
  htmlFor?: string
}

export function Field({
  label,
  error,
  helper,
  required = false,
  horizontal = false,
  children,
  htmlFor
}: FieldProps) {
  return (
    <div className={`form-field ${horizontal ? 'form-field--horizontal' : ''}`}>
      {label && (
        <label 
          htmlFor={htmlFor}
          className={`form-label ${required ? 'form-label--required' : ''}`}
        >
          {label}
        </label>
      )}
      {children}
      {error && <div className="form-error">{error}</div>}
      {helper && !error && <div className="form-helper">{helper}</div>}
    </div>
  )
}

