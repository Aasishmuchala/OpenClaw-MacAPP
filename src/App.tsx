import { useEffect, useMemo, useState } from "react";
import "./styles/app.css";
import { ChatList } from "./AppChat";
import { SettingsPanel } from "./SettingsPanel";
import { PermissionsPanel } from "./PermissionsPanel";
import { ModelsPanel } from "./ModelsPanel";
import { SidebarNav, type SectionKey } from "./components/SidebarNav";
import { ProfileSidebar } from "./panels/ProfileSidebar";
import { TopBar } from "./panels/TopBar";
import { ChatsPanel } from "./panels/ChatsPanel";
import { GatewayPanel } from "./panels/GatewayPanel";
import { autostartGet, autostartSet } from "./lib/autostart";
import { onTrayNewChat, onTrayRestartGateway } from "./lib/tray-events";
import {
  gatewayLogs,
  gatewayRestart,
  gatewayStart,
  gatewayStatus,
  gatewayStop,
  profilesCreate,
  profilesDelete,
  profilesList,
  profilesRename,
  profilesSetActive,
  secretDelete,
  secretGet,
  secretSet,
  chatsCreate,
  chatsDelete,
  chatsList,
  chatsRename,
  chatsUpdate,
  chatSend,
  chatThread,
  type Chat,
  type ChatThread,
  type GatewayLogs,
  type GatewayStatus,
  type ProfilesStore,
} from "./lib/tauri";

export default function App() {
  const [store, setStore] = useState<ProfilesStore | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // profile create handled in ProfileSidebar
  const [gw, setGw] = useState<GatewayStatus | null>(null);
  const [gwLogs, setGwLogs] = useState<GatewayLogs | null>(null);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [draft, setDraft] = useState("");
  const [launchOnLogin, setLaunchOnLogin] = useState<boolean | null>(null);
  const [section, setSection] = useState<SectionKey>("chats");

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

  useEffect(() => {
    (async () => {
      if (!active) return;
      try {
        const idx = await chatsList(active.id);
        setChats(idx.chats);
        const first = idx.chats[0]?.id ?? null;
        setActiveChatId((prev) => prev ?? first);
      } catch {
        // ignore
      }
    })();
  }, [active?.id]);

  useEffect(() => {
    (async () => {
      try {
        const v = await autostartGet();
        setLaunchOnLogin(v);
      } catch {
        setLaunchOnLogin(false);
      }
    })();
  }, []);

  useEffect(() => {
    let un1: (() => void) | null = null;
    let un2: (() => void) | null = null;

    (async () => {
      const l1 = await onTrayNewChat(() => {
        void createChat();
      });
      const l2 = await onTrayRestartGateway(() => {
        void gwRestart();
      });
      un1 = () => l1();
      un2 = () => l2();
    })();

    return () => {
      un1?.();
      un2?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  useEffect(() => {
    (async () => {
      if (!active || !activeChatId) {
        setThread(null);
        return;
      }
      try {
        const t = await chatThread(active.id, activeChatId);
        setThread(t);
      } catch {
        setThread(null);
      }
    })();
  }, [active?.id, activeChatId]);

  async function refreshGateway() {
    setBusy("Checking gateway…");
    try {
      if (!active) return;
      const s = await gatewayStatus(active.id);
      setGw(s);
      const l = await gatewayLogs(200);
      setGwLogs(l);
    } finally {
      setBusy(null);
    }
  }

  async function gwStart() {
    setBusy("Starting gateway…");
    try {
      if (!active) return;
      const s = await gatewayStart(active.id);
      setGw(s);
      const l = await gatewayLogs(200);
      setGwLogs(l);
    } finally {
      setBusy(null);
    }
  }

  async function gwStop() {
    setBusy("Stopping gateway…");
    try {
      if (!active) return;
      const s = await gatewayStop(active.id);
      setGw(s);
      const l = await gatewayLogs(200);
      setGwLogs(l);
    } finally {
      setBusy(null);
    }
  }

  async function gwRestart() {
    setBusy("Restarting gateway…");
    try {
      if (!active) return;
      const s = await gatewayRestart(active.id);
      setGw(s);
      const l = await gatewayLogs(200);
      setGwLogs(l);
    } finally {
      setBusy(null);
    }
  }

  async function createProfile(name: string) {
    const n = name.trim();
    if (!n) return;
    setBusy("Creating profile…");
    try {
      const s = await profilesCreate(n);
      setStore(s);
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

  async function createChat(title?: string) {
    if (!active) return;
    setBusy("Creating chat…");
    try {
      const c = await chatsCreate(active.id, title);
      const idx = await chatsList(active.id);
      setChats(idx.chats);
      setActiveChatId(c.id);
    } finally {
      setBusy(null);
    }
  }

  async function updateChatSettings(chatId: string, opts: { thinking?: string | null; agentId?: string | null }) {
    if (!active) return;
    setBusy("Saving chat settings…");
    try {
      const idx = await chatsUpdate(active.id, chatId, opts);
      setChats(idx.chats);
    } finally {
      setBusy(null);
    }
  }

  async function renameChat(id: string) {
    if (!active) return;
    const title = prompt("Rename chat to?");
    if (!title) return;
    setBusy("Renaming chat…");
    try {
      const idx = await chatsRename(active.id, id, title);
      setChats(idx.chats);
    } finally {
      setBusy(null);
    }
  }

  async function deleteChat(id: string) {
    if (!active) return;
    if (!confirm("Delete this chat?")) return;
    setBusy("Deleting chat…");
    try {
      const idx = await chatsDelete(active.id, id);
      setChats(idx.chats);
      if (activeChatId === id) {
        setActiveChatId(idx.chats[0]?.id ?? null);
      }
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!active || !activeChatId) return;
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setBusy("Sending…");
    try {
      const res = await chatSend(active.id, activeChatId, text);
      setThread(res.thread);
      const idx = await chatsList(active.id);
      setChats(idx.chats);
    } finally {
      setBusy(null);
    }
  }

  const topbarRight = (
    <>
      <div className="oc-toggle">
        <label>
          <input
            type="checkbox"
            checked={!!launchOnLogin}
            disabled={launchOnLogin === null || !!busy}
            onChange={async (e) => {
              const on = e.currentTarget.checked;
              setBusy(on ? "Enabling launch at login…" : "Disabling launch at login…");
              try {
                await autostartSet(on);
                setLaunchOnLogin(on);
              } finally {
                setBusy(null);
              }
            }}
          />
          <span>Launch at login</span>
        </label>
      </div>

      <button className="primary" type="button" onClick={demoSecretWrite} disabled={!active || !!busy}>
        Set demo secret
      </button>
      <button type="button" onClick={demoSecretRead} disabled={!active || !!busy}>
        Read
      </button>
      <button type="button" onClick={demoSecretDelete} disabled={!active || !!busy}>
        Delete
      </button>
    </>
  );

  return (
    <div className="oc-shell">
      <aside className="oc-sidebar">
        <ProfileSidebar
          store={store}
          busy={!!busy}
          busyText={busy}
          onCreate={async (name) => {
            await createProfile(name);
          }}
          onSetActive={setActive}
          onRename={renameProfile}
          onDelete={deleteProfile}
        />

        <div className="oc-section">
          <div className="oc-section-title">Sections</div>
          <SidebarNav value={section} onChange={setSection} disabled={!!busy} />
        </div>

        {section === "chats" ? (
          <div className="oc-section">
            <div className="oc-section-title">Chats</div>
            {/* ChatList includes create + list */}
            <div className="oc-chat-sidebar">
              {active ? (
                <ChatList
                  chats={chats}
                  activeChatId={activeChatId}
                  onSelect={(id) => setActiveChatId(id)}
                  onCreate={createChat}
                  onRename={renameChat}
                  onDelete={deleteChat}
                  busy={!!busy}
                />
              ) : (
                <div className="oc-empty">Create/select a profile first.</div>
              )}
            </div>
          </div>
        ) : null}
      </aside>

      <main className="oc-main">
        <TopBar title={active ? active.name : "…"} subtitle="Local profiles · OpenClaw gateway" right={topbarRight} />

        <div className="oc-content">
          <div className="oc-grid">
            {section === "chats" ? (
              <ChatsPanel
                chats={chats}
                activeChatId={activeChatId}
                thread={thread}
                draft={draft}
                busy={!!busy}
                onRefreshThread={async () => {
                  if (!active || !activeChatId) return;
                  const t = await chatThread(active.id, activeChatId);
                  setThread(t);
                }}
                onUpdateChatSettings={updateChatSettings}
                onDraftChange={setDraft}
                onSend={send}
              />
            ) : null}

            {section === "gateway" ? (
              <GatewayPanel
                gw={gw}
                logs={gwLogs}
                busy={!!busy}
                onRefresh={refreshGateway}
                onStart={gwStart}
                onStop={gwStop}
                onRestart={gwRestart}
              />
            ) : null}

            {section === "models" && active ? <ModelsPanel profileId={active.id} busy={!!busy} onBusy={setBusy} /> : null}
            {section === "permissions" ? <PermissionsPanel /> : null}
            {section === "settings" && active ? <SettingsPanel profileId={active.id} busy={!!busy} onBusy={setBusy} /> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
