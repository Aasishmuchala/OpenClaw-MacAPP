import { ChatThreadView } from "../AppChat";
import type { Chat, ChatThread } from "../lib/tauri";

export function ChatsPanel(props: {
  chats: Chat[];
  activeChatId: string | null;
  thread: ChatThread | null;
  draft: string;
  busy: boolean;
  onRefreshThread: () => Promise<void>;
  onResetThread: () => Promise<void>;
  onUpdateChatSettings: (chatId: string, opts: { thinking?: string | null; agentId?: string | null; worker?: string | null }) => Promise<void>;
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
              <div className="oc-thread-sub">Ollama (streaming) + local tools (exec/web_get)</div>

              {props.activeChatId ? (
                <div className="oc-thread-controls">
                  <label className="sr-only" htmlFor="worker">
                    Worker
                  </label>
                  <select
                    id="worker"
                    name="worker"
                    className="oc-select"
                    value={activeChat?.worker ?? "default"}
                    disabled={props.busy}
                    onChange={(e) => props.onUpdateChatSettings(props.activeChatId!, { worker: e.currentTarget.value })}
                  >
                    {["default", "build", "ops"].map((w) => (
                      <option key={w} value={w}>
                        worker: {w}
                      </option>
                    ))}
                  </select>
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
              <button
                type="button"
                onClick={() => props.onResetThread()}
                disabled={!props.activeChatId || props.busy}
              >
                Reset
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
