import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

/** Fenêtre modale accessible basée sur <dialog> (focus piégé, Échap pour fermer). */
export function Modal({ open, title, onClose, children, actions }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="modal-title">{title}</h2>
      <div className="modal-body">{children}</div>
      {actions && <div className="modal-actions">{actions}</div>}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
