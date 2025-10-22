import { forwardRef, InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'error' | 'success'
  inputSize?: 'small' | 'medium' | 'large'
  error?: boolean
  success?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = 'default', inputSize = 'medium', error, success, className = '', ...props }, ref) => {
    const classes = [
      'form-input',
      inputSize === 'small' && 'form-input--small',
      inputSize === 'large' && 'form-input--large',
      (error || variant === 'error') && 'form-input--error',
      (success || variant === 'success') && 'form-input--success',
      className
    ].filter(Boolean).join(' ')

    return <input ref={ref} className={classes} {...props} />
  }
)

Input.displayName = 'Input'

