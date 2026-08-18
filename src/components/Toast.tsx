import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "ok" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, kind, text }]);
      const ms = kind === "error" ? 6500 : 3800;
      timersRef.current.set(
        id,
        window.setTimeout(() => dismiss(id), ms),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  return { toasts, push, dismiss };
}

export function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host" aria-live="polite" aria-relevant="additions">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`toast toast--${item.kind}`}
          role={item.kind === "error" ? "alert" : "status"}
        >
          <span className="toast__text">{item.text}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Закрыть"
            onClick={() => onDismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
