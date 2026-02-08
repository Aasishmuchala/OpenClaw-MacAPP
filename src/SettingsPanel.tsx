import { useEffect, useState } from "react";
import {
  settingsGet,
  settingsSetDevFullExecAuto,
  settingsSetOllamaBaseUrl,
  settingsSetOllamaModel,
  settingsSetOpenclawPath,
  type ProfileSettings,
} from "./lib/tauri";

export function SettingsPanel(props: {
  profileId: string;
  busy: boolean;
  onBusy: (v: string | null) => void;
  onToast?: (t: { kind: "info" | "success" | "error"; title: string; message?: string }) => void;
}) {
  const [s, setS] = useState<ProfileSettings | null>(null);
  const [path, setPath] = useState<string>("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState<string>("ollama/huihui_ai/qwen3-abliterated:8b");
  const [devFullExecAuto, setDevFullExecAuto] = useState<boolean>(false);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [unlockPhrase, setUnlockPhrase] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        props.onBusy("Loading settings…");
        const ss = await settingsGet(props.profileId);
        setS(ss);
        setPath(ss.openclaw_path ?? "");
        setOllamaBaseUrl(ss.ollama_base_url ?? "http://localhost:11434");
        setOllamaModel(ss.ollama_model ?? "ollama/huihui_ai/qwen3-abliterated:8b");
        setDevFullExecAuto(Boolean(ss.dev_full_exec_auto));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        props.onToast?.({ kind: "error", title: "Failed to load settings", message: msg });
      } finally {
        props.onBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.profileId]);

  async function saveOpenclawPath() {
    props.onBusy("Saving OpenClaw path…");
    try {
      const ss = await settingsSetOpenclawPath(props.profileId, path.trim() ? path.trim() : null);
      setS(ss);
      props.onToast?.({ kind: "success", title: "Saved OpenClaw path" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      props.onToast?.({ kind: "error", title: "Failed to save", message: msg });
    } finally {
      props.onBusy(null);
    }
  }

  async function saveOllama() {
    props.onBusy("Saving Ollama settings…");
    try {
      let ss = await settingsSetOllamaBaseUrl(props.profileId, ollamaBaseUrl.trim() ? ollamaBaseUrl.trim() : null);
      ss = await settingsSetOllamaModel(props.profileId, ollamaModel.trim() ? ollamaModel.trim() : null);
      setS(ss);
      props.onToast?.({ kind: "success", title: "Saved Ollama settings" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      props.onToast?.({ kind: "error", title: "Failed to save Ollama settings", message: msg });
    } finally {
      props.onBusy(null);
    }
  }

  async function saveDevMode(enabled: boolean) {
    props.onBusy("Saving Developer Mode…");
    try {
      const ss = await settingsSetDevFullExecAuto(props.profileId, enabled);
      setS(ss);
      props.onToast?.({
        kind: enabled ? "success" : "info",
        title: enabled ? "DEV: Full Exec (Auto) enabled" : "Developer Mode disabled",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      props.onToast?.({ kind: "error", title: "Failed to update Developer Mode", message: msg });
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
            <button className="primary" onClick={saveOpenclawPath} disabled={props.busy}>
              Save
            </button>
            {s?.openclaw_path ? (
              <button onClick={() => setPath("")} disabled={props.busy}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="oc-sep" />

        <div className="oc-field">
          <div className="oc-field-label">Local Ollama</div>
          <div className="oc-field-help">
            Chat runs directly against Ollama for speed. Tools run locally when requested.
          </div>

          <div className="oc-field" style={{ marginTop: 10 }}>
            <div className="oc-field-label">Ollama base URL</div>
            <input
              className="oc-input"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={props.busy}
            />
          </div>

          <div className="oc-field" style={{ marginTop: 10 }}>
            <div className="oc-field-label">Default model id</div>
            <div className="oc-field-help">
              Use OpenClaw-style ids (e.g. <code>ollama/huihui_ai/qwen3-abliterated:8b</code>).
            </div>
            <input
              className="oc-input"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="ollama/huihui_ai/qwen3-abliterated:8b"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={props.busy}
            />
          </div>

          <div className="oc-row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={saveOllama} disabled={props.busy}>
              Save Ollama
            </button>
          </div>
        </div>

        <div className="oc-sep" />

        <div className="oc-field">
          <div className="oc-field-label">Developer Mode</div>
          <div className="oc-field-help">
            Full Exec (Auto) allows the model to run arbitrary shell commands without prompting. Dangerous.
          </div>

          {!unlocked ? (
            <div style={{ marginTop: 10 }}>
              <div className="oc-field-help">Type <code>I UNDERSTAND</code> to unlock:</div>
              <input
                className="oc-input"
                value={unlockPhrase}
                onChange={(e) => setUnlockPhrase(e.target.value)}
                placeholder="I UNDERSTAND"
                disabled={props.busy}
              />
              <div className="oc-row" style={{ marginTop: 10 }}>
                <button
                  className="primary"
                  disabled={props.busy}
                  onClick={() => {
                    if (unlockPhrase.trim() === "I UNDERSTAND") {
                      setUnlocked(true);
                      props.onToast?.({ kind: "info", title: "Developer Mode unlocked" });
                    } else {
                      props.onToast?.({ kind: "error", title: "Wrong phrase" });
                    }
                  }}
                >
                  Unlock
                </button>
              </div>
            </div>
          ) : (
            <div className="oc-row" style={{ marginTop: 10 }}>
              <button
                className={devFullExecAuto ? "danger" : "primary"}
                disabled={props.busy}
                onClick={async () => {
                  const next = !devFullExecAuto;
                  setDevFullExecAuto(next);
                  await saveDevMode(next);
                }}
              >
                {devFullExecAuto ? "Disable Full Exec (Auto)" : "Enable Full Exec (Auto)"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
