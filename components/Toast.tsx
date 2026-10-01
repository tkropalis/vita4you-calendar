"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export type ToastMessage = { tone: "neutral" | "success" | "error"; text: string };

const VISIBLE_MS = 5000;

export function Toast({ message, onDismiss }: { message: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message ? (
        <div className={`toast toast--${message.tone}`} key={message.text}>
          <span>{message.text}</span>
          <button type="button" className="toast__close" onClick={onDismiss} aria-label="Κλείσιμο ειδοποίησης">
            <X aria-hidden="true" className="icon" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
