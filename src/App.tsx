import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  profilesCreate,
  profilesDelete,
  profilesList,
  profilesRename,
  profilesSetActive,
  secretDelete,
  secretGet,
  secretSet,
  type ProfilesStore,
} from "./lib/tauri";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function App() {
  const [store, setStore] = useState<ProfilesStore | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");

  const active = useMemo(() => {
    const id = store?.active_profile_id ?? null;
    return store?.profiles.find((p) => p.id === id) ?? null;
  }, [store]);

  useEffect(() => {
    (async () => {
      try {
        setBusy("Loading profiles…");
        const s = await profilesList();
        setStore(s);
      } finally {
        setBusy(null);
      }
    })();
  }, []);

  async function createProfile() {
    const name = newProfileName.trim();
    if (!name) return;
    setBusy("Creating profile…");
    try {
      const s = await profilesCreate(name);
      setStore(s);
      setNewProfileName("");
    } finally {
      setBusy(null);
    }
  }

  async function setActive(profileId: string) {
    setBusy("Switching profile…");
    try {
      const s = await profilesSetActive(profileId);
      setStore(s);
    } finally {
      setBusy(null);
    }
  }

  async function renameProfile(profileId: string) {
    const name = prompt("New profile name?");
    if (!name) return;
    setBusy("Renaming…");
    try {
      const s = await profilesRename(profileId, name);
      setStore(s);
    } finally {
      setBusy(null);
    }
  }

  async function deleteProfile(profileId: string) {
    if (!confirm("Delete this profile? This cannot be undone.")) return;
    setBusy("Deleting…");
    try {
      const s = await profilesDelete(profileId);
      setStore(s);
    } finally {
      setBusy(null);
    }
  }

  async function demoSecretWrite() {
    if (!active) return;
    const v = prompt("Set a demo secret value (stored in Keychain)");
    if (v == null) return;
    setBusy("Writing secret…");
    try {
      await secretSet(active.id, "demo.secret", v);
      alert("Saved to Keychain for this profile.");
    } finally {
      setBusy(null);
    }
  }

  async function demoSecretRead() {
    if (!active) return;
    setBusy("Reading secret…");
    try {
      const v = await secretGet(active.id, "demo.secret");
      alert(v ? `Keychain value: ${v}` : "No demo secret set.");
    } finally {
      setBusy(null);
    }
  }

  async function demoSecretDelete() {
    if (!active) return;
    setBusy("Deleting secret…");
    try {
      await secretDelete(active.id, "demo.secret");
      alert("Deleted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="oc-shell">
      <aside className="oc-sidebar">
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
            <input
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="New profile…"
            />
            <button onClick={createProfile} disabled={!newProfileName.trim() || !!busy}>
              Add
            </button>
          </div>

          <div className="oc-profile-list">
            {(store?.profiles ?? []).map((p) => {
              const isActive = p.id === (store?.active_profile_id ?? "");
              return (
                <div key={p.id} className={`oc-profile ${isActive ? "active" : ""}`}>
                  <button className="oc-profile-main" onClick={() => setActive(p.id)} disabled={!!busy}>
                    <div className="oc-avatar">{initials(p.name)}</div>
                    <div className="oc-profile-meta">
                      <div className="oc-profile-name">{p.name}</div>
                      <div className="oc-profile-id">{p.id}</div>
                    </div>
                  </button>
                  <div className="oc-profile-actions">
                    <button onClick={() => renameProfile(p.id)} disabled={!!busy}>
                      Rename
                    </button>
                    <button onClick={() => deleteProfile(p.id)} disabled={!!busy || store?.profiles.length === 1}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="oc-foot">
          <div className="oc-foot-line">{busy ?? "Ready"}</div>
        </div>
      </aside>

      <main className="oc-main">
        <div className="oc-topbar">
          <div className="oc-topbar-left">
            <div className="oc-h1">{active ? active.name : "…"}</div>
            <div className="oc-h2">Profile settings + secrets (Keychain)</div>
          </div>
          <div className="oc-topbar-right">
            <button className="primary" onClick={demoSecretWrite} disabled={!active || !!busy}>
              Set demo secret
            </button>
            <button onClick={demoSecretRead} disabled={!active || !!busy}>
              Read
            </button>
            <button onClick={demoSecretDelete} disabled={!active || !!busy}>
              Delete
            </button>
          </div>
        </div>

        <div className="oc-content">
          <div className="oc-card">
            <div className="oc-card-title">Milestone 1 (in progress)</div>
            <div className="oc-card-body">
              <ul>
                <li>Profiles: create/switch/rename/delete ✅</li>
                <li>Local storage: <code>profiles.json</code> in app data dir ✅</li>
                <li>Keychain secrets per profile ✅</li>
                <li>Next: chats + embedded gateway manager</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
