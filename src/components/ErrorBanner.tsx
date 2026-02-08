export function ErrorBanner(props: { title: string; message?: string; onClose?: () => void }) {
  return (
    <div className="oc-banner" role="status" aria-live="polite">
      <div className="oc-banner-title">{props.title}</div>
      {props.message ? <div className="oc-banner-msg">{props.message}</div> : null}
      {props.onClose ? (
        <button type="button" className="oc-banner-x" aria-label="Dismiss" onClick={props.onClose}>
          ×
        </button>
      ) : null}
    </div>
  );
}
