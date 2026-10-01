"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export type ToastMessage = {
  tone: "neutral" | "error";
  text: string;
  action?: { label: string; onClick: () => void };
};

const VISIBLE_MS = 5000;
const VISIBLE_WITH_ACTION_MS = 9000;

export function Toast({ message, onDismiss }: { message: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, message.action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message ? (
        <div className={`toast toast--${message.tone}`}>
          <span className="toast__text">{message.text}</span>
          {message.action ? (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                message.action?.onClick();
                onDismiss();
              }}
            >
              {message.action.label}
            </button>
          ) : null}
          <button type="button" className="toast__close" onClick={onDismiss} aria-label="Κλείσιμο ειδοποίησης">
            <X aria-hidden="true" className="icon" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
