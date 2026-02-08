import { ChatThreadView } from "../AppChat";
import type { Chat, ChatThread } from "../lib/tauri";

export function ChatsPanel(props: {
  chats: Chat[];
  activeChatId: string | null;
  thread: ChatThread | null;
  draft: string;
  busy: boolean;
  onRefreshThread: () => Promise<void>;
  onUpdateChatSettings: (chatId: string, opts: { thinking?: string | null; agentId?: string | null }) => Promise<void>;
  onDraftChange: (v: string) => void;
  onSend: () => Promise<void>;
}) {
  const activeChat = props.chats.find((c) => c.id === props.activeChatId) ?? null;

  return (
    <div className="oc-card">
      <div className="oc-card-title">Chats</div>
      <div className="oc-card-body">
        <div className="oc-thread-wrap">
          <div className="oc-thread-header">
            <div>
              <div className="oc-thread-title">{activeChat?.title ?? "Select a chat"}</div>
              <div className="oc-thread-sub">Native UI → OpenClaw CLI (agent turns via gateway)</div>

              {props.activeChatId ? (
                <div className="oc-thread-controls">
                  <label className="sr-only" htmlFor="thinking">
                    Thinking
                  </label>
                  <select
                    id="thinking"
                    name="thinking"
                    className="oc-select"
                    value={activeChat?.thinking ?? "low"}
                    disabled={props.busy}
                    onChange={(e) =>
                      props.onUpdateChatSettings(props.activeChatId!, { thinking: e.currentTarget.value })
                    }
                  >
                    {["off", "minimal", "low", "medium", "high"].map((t) => (
                      <option key={t} value={t}>
                        thinking: {t}
                      </option>
                    ))}
                  </select>

                  <label className="sr-only" htmlFor="agent-id">
                    Agent ID (optional)
                  </label>
                  <input
                    id="agent-id"
                    name="agent-id"
                    className="oc-input"
                    style={{ height: 34, padding: "6px 10px" }}
                    placeholder="agent id (optional)"
                    defaultValue={activeChat?.agent_id ?? ""}
                    disabled={props.busy}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onBlur={(e) => props.onUpdateChatSettings(props.activeChatId!, { agentId: e.currentTarget.value })}
                  />
                </div>
              ) : null}
            </div>

            <div className="oc-thread-actions">
              <button
                type="button"
                onClick={() => props.onRefreshThread()}
                disabled={!props.activeChatId || props.busy}
              >
                Refresh
              </button>
            </div>
          </div>

          <ChatThreadView messages={props.thread?.messages ?? []} />

          <div className="oc-compose">
            <label className="sr-only" htmlFor="composer">
              Message
            </label>
            <textarea
              id="composer"
              name="composer"
              value={props.draft}
              onChange={(e) => props.onDraftChange(e.target.value)}
              placeholder={props.activeChatId ? "Message…" : "Create a chat first"}
              disabled={!props.activeChatId || props.busy}
            />
            <button
              type="button"
              className="primary"
              onClick={() => props.onSend()}
              disabled={!props.activeChatId || props.busy || !props.draft.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
