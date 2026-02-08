import { useEffect, useMemo, useState, type ReactNode } from "react";

export type ToastKind = "info" | "success" | "error";

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  createdAt: number;
  timeoutMs: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const api = useMemo(() => {
    function push(t: Omit<Toast, "id" | "createdAt">) {
      const toast: Toast = { ...t, id: uid(), createdAt: Date.now() };
      setToasts((prev) => [toast, ...prev].slice(0, 5));
      return toast.id;
    }

    function dismiss(id: string) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }

    function clear() {
      setToasts([]);
    }

    return { toasts, push, dismiss, clear };
  }, [toasts]);

  return api;
}

export function ToastHost(props: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const { toasts, onDismiss } = props;

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        onDismiss(t.id);
      }, t.timeoutMs),
    );

    return () => {
      timers.forEach((x) => window.clearTimeout(x));
    };
  }, [toasts, onDismiss]);

  return (
    <div className="oc-toasts" aria-live="polite" aria-relevant="additions">
      {props.toasts.map((t) => (
        <div key={t.id} className={`oc-toast ${t.kind}`}>
          <div className="oc-toast-main">
            <div className="oc-toast-title">{t.title}</div>
            {t.message ? <div className="oc-toast-msg">{t.message}</div> : null}
          </div>
          <button
            type="button"
            className="oc-toast-x"
            aria-label="Dismiss notification"
            onClick={() => props.onDismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastAction(props: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="oc-toast-action" onClick={props.onClick}>
      {props.children}
    </button>
  );
}
