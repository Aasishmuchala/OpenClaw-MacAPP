import { useEffect, type ReactNode } from "react";

export function Modal(props: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!props.open) return null;

  return (
    <div className="oc-modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <div
        className="oc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="oc-modal-head">
          <div className="oc-modal-title">{props.title}</div>
          <button type="button" className="oc-modal-x" aria-label="Close" onClick={props.onClose}>
            ×
          </button>
        </div>
        <div className="oc-modal-body">{props.children}</div>
        {props.footer ? <div className="oc-modal-foot">{props.footer}</div> : null}
      </div>
    </div>
  );
}
