import React, { useId } from 'react';

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="modal__close-icon"
          >
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
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


