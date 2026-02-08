import { useEffect, useState } from "react";
import { settingsGet, settingsSetOpenclawPath, type ProfileSettings } from "./lib/tauri";

export function SettingsPanel(props: { profileId: string; busy: boolean; onBusy: (v: string | null) => void }) {
  const [s, setS] = useState<ProfileSettings | null>(null);
  const [path, setPath] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        props.onBusy("Loading settings…");
        const ss = await settingsGet(props.profileId);
        setS(ss);
        setPath(ss.openclaw_path ?? "");
      } finally {
        props.onBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.profileId]);

  async function save() {
    props.onBusy("Saving settings…");
    try {
      const ss = await settingsSetOpenclawPath(props.profileId, path.trim() ? path.trim() : null);
      setS(ss);
    } finally {
      props.onBusy(null);
    }
  }

  return (
    <div className="oc-card">
      <div className="oc-card-title">Settings</div>
      <div className="oc-card-body">
        <div className="oc-field">
          <div className="oc-field-label">OpenClaw CLI path (optional override)</div>
          <div className="oc-field-help">
            Leave blank to auto-detect <code>openclaw</code> from PATH.
          </div>
          <label className="sr-only" htmlFor="openclaw-path">
            OpenClaw CLI Path
          </label>
          <input
            id="openclaw-path"
            name="openclaw-path"
            className="oc-input"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/path/to/openclaw"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={props.busy}
          />
          <div className="oc-row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={save} disabled={props.busy}>
              Save
            </button>
            {s?.openclaw_path ? (
              <button onClick={() => setPath("")} disabled={props.busy}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
