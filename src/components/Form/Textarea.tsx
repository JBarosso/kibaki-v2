import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'error' | 'success'
  textareaSize?: 'small' | 'medium' | 'large'
  error?: boolean
  success?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ variant = 'default', textareaSize = 'medium', error, success, className = '', ...props }, ref) => {
    const classes = [
      'form-textarea',
      textareaSize === 'small' && 'form-textarea--small',
      textareaSize === 'large' && 'form-textarea--large',
      (error || variant === 'error') && 'form-textarea--error',
      (success || variant === 'success') && 'form-textarea--success',
      className
    ].filter(Boolean).join(' ')

    return <textarea ref={ref} className={classes} {...props} />
  }
)

Textarea.displayName = 'Textarea'

