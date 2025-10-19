import React, { useId } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  const titleId = title ? useId() : undefined;
  if (!open) return null;

  return (
    <div
      className="modal__overlay"
      aria-modal="true"
      role="dialog"
      aria-labelledby={titleId}
    >
      <button
        aria-label="Fermer"
        className="modal__backdrop"
        onClick={onClose}
      />

      <div className="modal__content">
        <button
          aria-label="Fermer le modal"
          onClick={onClose}
          className="modal__close-button"
        >
          <X className="modal__close-icon" />
        </button>

        {title ? (
          <h3 id={titleId} className="modal__title">{title}</h3>
        ) : null}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export default Modal;


