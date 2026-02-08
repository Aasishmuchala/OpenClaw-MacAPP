import { useMemo, useState } from "react";
import type { ProfilesStore } from "../lib/tauri";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ProfileSidebar(props: {
  store: ProfilesStore | null;
  busy: boolean;
  busyText: string | null;
  onCreate: (name: string) => Promise<void>;

  onSetActive: (profileId: string) => Promise<void>;
  onRename: (profileId: string) => Promise<void>;
  onDelete: (profileId: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");

  const activeId = props.store?.active_profile_id ?? null;
  const canDelete = (props.store?.profiles?.length ?? 0) > 1;

  const profiles = useMemo(() => props.store?.profiles ?? [], [props.store]);

  return (
    <div>
      <div className="oc-brand">
        <div className="oc-dot" />
        <div>
          <div className="oc-title">OpenClaw</div>
          <div className="oc-subtitle">Desktop (local-first)</div>
        </div>
      </div>

      <div className="oc-section">
        <div className="oc-section-title">Profiles</div>

        <div className="oc-profile-create">
          <label className="sr-only" htmlFor="new-profile">New Profile</label>
          <input
            id="new-profile"
            name="new-profile"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New profile…"
          />
          <button
            type="button"
            onClick={async () => {
              const name = newName.trim();
              if (!name) return;
              await props.onCreate(name);
              setNewName("");
            }}
            disabled={!newName.trim() || props.busy}
          >
            Add
          </button>
        </div>

        <div className="oc-profile-list">
          {profiles.map((p) => {
            const isActive = p.id === activeId;
            return (
              <div key={p.id} className={`oc-profile ${isActive ? "active" : ""}`}>
                <button type="button" className="oc-profile-main" onClick={() => props.onSetActive(p.id)} disabled={props.busy}>
                  <div className="oc-avatar">{initials(p.name)}</div>
                  <div className="oc-profile-meta">
                    <div className="oc-profile-name">{p.name}</div>
                    <div className="oc-profile-id">{p.id}</div>
                  </div>
                </button>
                <div className="oc-profile-actions">
                  <button type="button" onClick={() => props.onRename(p.id)} disabled={props.busy}>
                    Rename
                  </button>
                  <button type="button" onClick={() => props.onDelete(p.id)} disabled={props.busy || !canDelete}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="oc-foot" aria-live="polite">
        <div className="oc-foot-line">{props.busyText ?? "Ready"}</div>
      </div>
    </div>
  );
}
