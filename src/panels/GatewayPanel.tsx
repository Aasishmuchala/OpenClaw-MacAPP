import type { GatewayLogs, GatewayStatus } from "../lib/tauri";

export function GatewayPanel(props: {
  gw: GatewayStatus | null;
  logs: GatewayLogs | null;
  busy: boolean;
  onRefresh: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
}) {
  return (
    <div className="oc-card">
      <div className="oc-card-title">Gateway</div>
      <div className="oc-card-body">
        <div className="oc-row">
          <button type="button" className="primary" onClick={() => props.onRefresh()} disabled={props.busy}>
            Refresh
          </button>
          <button type="button" onClick={() => props.onStart()} disabled={props.busy}>
            Start
          </button>
          <button type="button" onClick={() => props.onStop()} disabled={props.busy}>
            Stop
          </button>
          <button type="button" onClick={() => props.onRestart()} disabled={props.busy}>
            Restart
          </button>
        </div>

        <div className="oc-mono">
          <div className="oc-mono-title">Status output</div>
          <pre>{props.gw?.stdout || "(not checked yet)"}</pre>
          {props.gw?.stderr ? (
            <>
              <div className="oc-mono-title">stderr</div>
              <pre className="danger">{props.gw.stderr}</pre>
            </>
          ) : null}
        </div>

        <div className="oc-mono">
          <div className="oc-mono-title">gateway.log (tail)</div>
          <pre>{props.logs?.out || ""}</pre>
        </div>

        <div className="oc-mono">
          <div className="oc-mono-title">gateway.err.log (tail)</div>
          <pre className="danger">{props.logs?.err || ""}</pre>
        </div>
      </div>
    </div>
  );
}
