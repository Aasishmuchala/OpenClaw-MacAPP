import { useMemo, useState } from "react";
import type { Chat, ChatMessage } from "./lib/tauri";

function fmtTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString();
}

export function ChatList(props: {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onCreate: (title?: string) => Promise<void>;
  onRename: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");

  return (
    <div className="oc-section">
      <div className="oc-section-title">Chats</div>

      <div className="oc-chat-create">
        <label className="sr-only" htmlFor="new-chat-title">
          New Chat Title
        </label>
        <input
          id="new-chat-title"
          name="new-chat-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New chat title…"
        />
        <button
          className="primary"
          disabled={props.busy}
          onClick={async () => {
            await props.onCreate(title.trim() || undefined);
            setTitle("");
          }}
        >
          New
        </button>
      </div>

      <div className="oc-chat-list">
        {props.chats.map((c) => {
          const isActive = c.id === props.activeChatId;
          return (
            <div key={c.id} className={`oc-chat ${isActive ? "active" : ""}`}>
              <button className="oc-chat-main" disabled={props.busy} onClick={() => props.onSelect(c.id)}>
                <div className="oc-chat-title">{c.title}</div>
                <div className="oc-chat-sub">{fmtTime(c.updated_at_ms)}</div>
              </button>
              <div className="oc-chat-actions">
                <button disabled={props.busy} onClick={() => props.onRename(c.id)}>
                  Rename
                </button>
                <button disabled={props.busy} onClick={() => props.onDelete(c.id)}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {props.chats.length === 0 ? <div className="oc-empty">No chats yet.</div> : null}
      </div>
    </div>
  );
}

export function ChatThreadView(props: { messages: ChatMessage[] }) {
  const items = useMemo(() => props.messages, [props.messages]);

  return (
    <div className="oc-thread">
      {items.map((m) => (
        <div
          key={m.id}
          className={`oc-msg ${m.role === "assistant" ? "assistant" : m.role === "tool" ? "tool" : "user"}`}
        >
          <div className="oc-msg-meta">
            {m.role === "assistant" ? "Assistant" : m.role === "tool" ? "Tool" : "You"}
          </div>
          <div className="oc-msg-text">{m.text}</div>
        </div>
      ))}
      {items.length === 0 ? <div className="oc-empty">Say hi.</div> : null}
    </div>
  );
}
