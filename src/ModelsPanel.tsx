import { useEffect, useState } from "react";
import { modelsSetDefault, modelsStatus, type ModelsStatus } from "./lib/models";

export function ModelsPanel(props: { profileId: string; busy: boolean; onBusy: (v: string | null) => void }) {
  const [status, setStatus] = useState<ModelsStatus | null>(null);
  const [model, setModel] = useState("");

  async function refresh() {
    props.onBusy("Loading models…");
    try {
      const s = await modelsStatus(props.profileId);
      setStatus(s);
    } finally {
      props.onBusy(null);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.profileId]);

  async function setDefault() {
    const m = model.trim();
    if (!m) return;
    props.onBusy("Setting default model…");
    try {
      const s = await modelsSetDefault(props.profileId, m);
      setStatus(s);
      setModel("");
    } finally {
      props.onBusy(null);
    }
  }

  return (
    <div className="oc-card">
      <div className="oc-card-title">Models</div>
      <div className="oc-card-body">
        <div className="oc-row">
          <button className="primary" onClick={refresh} disabled={props.busy}>
            Refresh
          </button>
        </div>

        <div className="oc-field" style={{ marginTop: 12 }}>
          <div className="oc-field-label">Set default model (per OpenClaw profile)</div>
          <div className="oc-field-help">Example: openai-codex/gpt-5.2</div>
          <div className="oc-row">
            <label className="sr-only" htmlFor="default-model">
              Default Model
            </label>
            <input
              id="default-model"
              name="default-model"
              className="oc-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model id"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button className="primary" onClick={setDefault} disabled={props.busy || !model.trim()}>
              Set
            </button>
          </div>
        </div>

        <div className="oc-mono" style={{ marginTop: 12 }}>
          <div className="oc-mono-title">openclaw models status</div>
          <pre>{status?.stdout || "(no output yet)"}</pre>
          {status?.stderr ? <pre className="danger">{status.stderr}</pre> : null}
        </div>
      </div>
    </div>
  );
}
