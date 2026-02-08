import { useEffect, useMemo, useState } from "react";
import "./styles/app.css";
import { ChatList } from "./AppChat";
import { SettingsPanel } from "./SettingsPanel";
import { PermissionsPanel } from "./PermissionsPanel";
import { ModelsPanel } from "./ModelsPanel";
import { SidebarNav, type SectionKey } from "./components/SidebarNav";
import { Modal } from "./components/Modal";
import { ErrorBanner } from "./components/ErrorBanner";
import { ToastHost, useToasts } from "./components/ToastHost";
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

  const [banner, setBanner] = useState<{ title: string; message?: string } | null>(null);
  const toasts = useToasts();

  const [modal, setModal] = useState<
    | null
    | { kind: "rename_profile"; profileId: string; value: string }
    | { kind: "delete_profile"; profileId: string }
    | { kind: "rename_chat"; chatId: string; value: string }
    | { kind: "delete_chat"; chatId: string }
    | { kind: "secret_set"; value: string }
    | { kind: "secret_show"; value: string | null }
    | { kind: "secret_delete" }
  >(null);

  const active = useMemo(() => {
    const id = store?.active_profile_id ?? null;
    return store?.profiles.find((p) => p.id === id) ?? null;
  }, [store]);

  const activeProfileId = active?.id ?? null;

  useEffect(() => {
    (async () => {
      try {
        setBusy("Loading profiles…");
        const s = await profilesList();
        setStore(s);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setBanner({ title: "Failed to load profiles", message: msg });
        toasts.push({ kind: "error", title: "Failed to load profiles", message: msg, timeoutMs: 6000 });
      } finally {
        setBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!activeProfileId) return;
      try {
        const idx = await chatsList(activeProfileId);
        setChats(idx.chats);
        const first = idx.chats[0]?.id ?? null;
        setActiveChatId((prev) => prev ?? first);
      } catch {
        // ignore
      }
    })();
  }, [activeProfileId]);

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
      if (!activeProfileId || !activeChatId) {
        setThread(null);
        return;
      }
      try {
        const t = await chatThread(activeProfileId, activeChatId);
        setThread(t);
      } catch {
        setThread(null);
      }
    })();
  }, [activeProfileId, activeChatId]);

  async function refreshGateway() {
    setBusy("Checking gateway…");
    try {
      if (!active) return;
      const s = await gatewayStatus(active.id);
      setGw(s);
      const l = await gatewayLogs(200);
      setGwLogs(l);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ kind: "error", title: "Gateway check failed", message: msg, timeoutMs: 6000 });
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
      toasts.push({ kind: "success", title: "Gateway started", timeoutMs: 2500 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ kind: "error", title: "Gateway start failed", message: msg, timeoutMs: 6000 });
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
      toasts.push({ kind: "success", title: "Gateway stopped", timeoutMs: 2500 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ kind: "error", title: "Gateway stop failed", message: msg, timeoutMs: 6000 });
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
      toasts.push({ kind: "success", title: "Gateway restarted", timeoutMs: 2500 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ kind: "error", title: "Gateway restart failed", message: msg, timeoutMs: 6000 });
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
      toasts.push({ kind: "success", title: "Profile created", message: n, timeoutMs: 2500 });
    } finally {
      setBusy(null);
    }
  }

  async function setActive(profileId: string) {
    setBusy("Switching profile…");
    try {
      const s = await profilesSetActive(profileId);
      setStore(s);
      setBanner(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ kind: "error", title: "Failed to switch profile", message: msg, timeoutMs: 6000 });
    } finally {
      setBusy(null);
    }
  }

  async function renameProfile(profileId: string) {
    const current = store?.profiles.find((p) => p.id === profileId)?.name ?? "";
    setModal({ kind: "rename_profile", profileId, value: current });
  }

  async function deleteProfile(profileId: string) {
    setModal({ kind: "delete_profile", profileId });
  }

  async function demoSecretWrite() {
    if (!active) return;
    setModal({ kind: "secret_set", value: "" });
  }

  async function demoSecretRead() {
    if (!active) return;
    setBusy("Reading secret…");
    try {
      const v = await secretGet(active.id, "demo.secret");
      setModal({ kind: "secret_show", value: v });
    } finally {
      setBusy(null);
    }
  }

  async function demoSecretDelete() {
    if (!active) return;
    setModal({ kind: "secret_delete" });
  }

  async function createChat(title?: string) {
    if (!active) return;
    setBusy("Creating chat…");
    try {
      const c = await chatsCreate(active.id, title);
      const idx = await chatsList(active.id);
      setChats(idx.chats);
      setActiveChatId(c.id);
      toasts.push({ kind: "success", title: "Chat created", message: c.title, timeoutMs: 2500 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ kind: "error", title: "Failed to create chat", message: msg, timeoutMs: 6000 });
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

  async function renameChat(chatId: string) {
    const current = chats.find((c) => c.id === chatId)?.title ?? "";
    setModal({ kind: "rename_chat", chatId, value: current });
  }

  async function deleteChat(chatId: string) {
    setModal({ kind: "delete_chat", chatId });
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

      const last = res.thread.messages[res.thread.messages.length - 1];
      if (last?.role === "assistant" && last.text.startsWith("[error]")) {
        toasts.push({ kind: "error", title: "Send failed", message: last.text, timeoutMs: 8000 });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toasts.push({ kind: "error", title: "Send failed", message: msg, timeoutMs: 8000 });
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

        <Modal
          open={modal?.kind === "rename_profile"}
          title="Rename Profile"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} disabled={!!busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busy || modal?.kind !== "rename_profile" || !modal.value.trim()}
                onClick={async () => {
                  if (!modal || modal.kind !== "rename_profile") return;
                  setBusy("Renaming…");
                  try {
                    const newName = modal.value.trim();
                    const s = await profilesRename(modal.profileId, newName);
                    setStore(s);
                    setModal(null);
                    toasts.push({ kind: "success", title: "Profile renamed", message: newName, timeoutMs: 2500 });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Save
              </button>
            </>
          }
        >
          <div className="oc-field">
            <div className="oc-field-label">Profile name</div>
            <label className="sr-only" htmlFor="rename-profile">
              Profile name
            </label>
            <input
              id="rename-profile"
              name="rename-profile"
              className="oc-input"
              value={modal?.kind === "rename_profile" ? modal.value : ""}
              onChange={(e) => {
                const v = e.target.value;
                setModal((m) => (m && m.kind === "rename_profile" ? { ...m, value: v } : m));
              }}
              disabled={!!busy}
            />
          </div>
        </Modal>

        <Modal
          open={modal?.kind === "delete_profile"}
          title="Delete Profile"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} disabled={!!busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busy || store?.profiles.length === 1}
                onClick={async () => {
                  if (!modal || modal.kind !== "delete_profile") return;
                  setBusy("Deleting…");
                  try {
                    const s = await profilesDelete(modal.profileId);
                    setStore(s);
                    setModal(null);
                    toasts.push({ kind: "success", title: "Profile deleted", timeoutMs: 2500 });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <div className="oc-muted">This cannot be undone.</div>
        </Modal>

        <Modal
          open={modal?.kind === "rename_chat"}
          title="Rename Chat"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} disabled={!!busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busy || modal?.kind !== "rename_chat" || !modal.value.trim()}
                onClick={async () => {
                  if (!active) return;
                  if (!modal || modal.kind !== "rename_chat") return;
                  setBusy("Renaming chat…");
                  try {
                    const newTitle = modal.value.trim();
                    const idx = await chatsRename(active.id, modal.chatId, newTitle);
                    setChats(idx.chats);
                    setModal(null);
                    toasts.push({ kind: "success", title: "Chat renamed", message: newTitle, timeoutMs: 2500 });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Save
              </button>
            </>
          }
        >
          <div className="oc-field">
            <div className="oc-field-label">Chat title</div>
            <label className="sr-only" htmlFor="rename-chat">
              Chat title
            </label>
            <input
              id="rename-chat"
              name="rename-chat"
              className="oc-input"
              value={modal?.kind === "rename_chat" ? modal.value : ""}
              onChange={(e) => {
                const v = e.target.value;
                setModal((m) => (m && m.kind === "rename_chat" ? { ...m, value: v } : m));
              }}
              disabled={!!busy}
            />
          </div>
        </Modal>

        <Modal
          open={modal?.kind === "delete_chat"}
          title="Delete Chat"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} disabled={!!busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busy}
                onClick={async () => {
                  if (!active) return;
                  if (!modal || modal.kind !== "delete_chat") return;
                  setBusy("Deleting chat…");
                  try {
                    const idx = await chatsDelete(active.id, modal.chatId);
                    setChats(idx.chats);
                    if (activeChatId === modal.chatId) {
                      setActiveChatId(idx.chats[0]?.id ?? null);
                    }
                    setModal(null);
                    toasts.push({ kind: "success", title: "Chat deleted", timeoutMs: 2500 });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <div className="oc-muted">This cannot be undone.</div>
        </Modal>

        <Modal
          open={modal?.kind === "secret_set"}
          title="Set Demo Secret"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} disabled={!!busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busy || modal?.kind !== "secret_set"}
                onClick={async () => {
                  if (!active) return;
                  if (!modal || modal.kind !== "secret_set") return;
                  setBusy("Writing secret…");
                  try {
                    await secretSet(active.id, "demo.secret", modal.value);
                    setModal({ kind: "secret_show", value: modal.value });
                    toasts.push({ kind: "success", title: "Secret saved", timeoutMs: 2500 });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Save
              </button>
            </>
          }
        >
          <div className="oc-field">
            <div className="oc-field-label">Value</div>
            <div className="oc-field-help">Stored in macOS Keychain for the active profile.</div>
            <label className="sr-only" htmlFor="secret">
              Secret value
            </label>
            <input
              id="secret"
              name="secret"
              className="oc-input"
              value={modal?.kind === "secret_set" ? modal.value : ""}
              onChange={(e) => {
                const v = e.target.value;
                setModal((m) => (m && m.kind === "secret_set" ? { ...m, value: v } : m));
              }}
              disabled={!!busy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </Modal>

        <Modal
          open={modal?.kind === "secret_show"}
          title="Demo Secret"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)}>
                Close
              </button>
            </>
          }
        >
          <div className="oc-mono">
            <div className="oc-mono-title">Value</div>
            <pre>{modal?.kind === "secret_show" ? (modal.value ?? "(not set)") : ""}</pre>
          </div>
        </Modal>

        <Modal
          open={modal?.kind === "secret_delete"}
          title="Delete Demo Secret"
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setModal(null)} disabled={!!busy}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busy}
                onClick={async () => {
                  if (!active) return;
                  setBusy("Deleting secret…");
                  try {
                    await secretDelete(active.id, "demo.secret");
                    setModal({ kind: "secret_show", value: null });
                    toasts.push({ kind: "success", title: "Secret deleted", timeoutMs: 2500 });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <div className="oc-muted">This removes the secret from Keychain for the active profile.</div>
        </Modal>

        <ToastHost toasts={toasts.toasts} onDismiss={toasts.dismiss} />

        <div className="oc-content">
          {banner ? (
            <ErrorBanner title={banner.title} message={banner.message} onClose={() => setBanner(null)} />
          ) : null}
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

            {section === "models" && active ? (
              <ModelsPanel
                profileId={active.id}
                busy={!!busy}
                onBusy={setBusy}
                onToast={(t) => toasts.push({ ...t, timeoutMs: t.kind === "success" ? 2500 : 6000 })}
              />
            ) : null}
            {section === "permissions" ? <PermissionsPanel /> : null}
            {section === "settings" && active ? (
              <SettingsPanel
                profileId={active.id}
                busy={!!busy}
                onBusy={setBusy}
                onToast={(t) => toasts.push({ ...t, timeoutMs: t.kind === "success" ? 2500 : 6000 })}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
