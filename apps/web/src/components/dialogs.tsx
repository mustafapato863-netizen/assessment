import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/use-focus-trap';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'standard' | 'destructive';
  consequences?: string[];
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'standard',
  consequences = [],
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(isOpen, cardRef, busy ? undefined : onCancel);

  if (!isOpen) return null;

  const isDestructive = severity === 'destructive';

  return (
    <div
      className="drawer-backdrop dialog-backdrop"
      onMouseDown={(e) => {
        if (!busy && e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={cardRef}
        className={`confirm-dialog-card panel ${isDestructive ? 'destructive' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div className="confirm-dialog-head">
          <span className={`confirm-dialog-icon ${isDestructive ? 'danger' : 'brand'}`}>
            {isDestructive ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
          </span>
          <div className="confirm-dialog-copy">
            <h3 id="confirm-dialog-title">{title}</h3>
            <p id="confirm-dialog-desc">{description}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close confirmation dialog"
          >
            <X size={18} />
          </button>
        </div>

        {consequences.length > 0 && (
          <ul className="confirm-consequences">
            {consequences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDestructive ? 'danger-button' : 'primary-button'}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  minLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'standard' | 'destructive';
  busy?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export function PromptDialog({
  isOpen,
  title,
  description,
  label,
  placeholder = 'Provide clear governance rationale…',
  initialValue = '',
  minLength = 10,
  confirmLabel = 'Submit',
  cancelLabel = 'Cancel',
  severity = 'standard',
  busy = false,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(isOpen, cardRef, busy ? undefined : onCancel);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTouched(false);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const trimmed = value.trim();
  const isValid = trimmed.length >= minLength;
  const isDestructive = severity === 'destructive';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid || busy) return;
    void onConfirm(trimmed);
  };

  return (
    <div
      className="drawer-backdrop dialog-backdrop"
      onMouseDown={(e) => {
        if (!busy && e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={cardRef}
        className={`confirm-dialog-card panel ${isDestructive ? 'destructive' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        aria-describedby="prompt-dialog-desc"
      >
        <div className="confirm-dialog-head">
          <span className={`confirm-dialog-icon ${isDestructive ? 'danger' : 'brand'}`}>
            {isDestructive ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
          </span>
          <div className="confirm-dialog-copy">
            <h3 id="prompt-dialog-title">{title}</h3>
            <p id="prompt-dialog-desc">{description}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close prompt dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="prompt-dialog-form">
          <label className="field">
            <span>
              {label} {minLength > 0 && <b>*</b>}
            </span>
            <textarea
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              disabled={busy}
            />
            {touched && !isValid && (
              <small className="field-error">
                Please enter at least {minLength} characters ({trimmed.length}/{minLength}).
              </small>
            )}
          </label>

          <div className="confirm-dialog-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={isDestructive ? 'danger-button' : 'primary-button'}
              disabled={busy}
            >
              {busy ? 'Submitting…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
