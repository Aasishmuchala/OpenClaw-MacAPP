use std::{
  collections::{HashMap, HashSet},
  fs,
  path::PathBuf,
  sync::{atomic::{AtomicU64, Ordering}, Arc, Mutex},
  thread,
  time::{Duration, Instant},
};

use once_cell::sync::Lazy;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::ollama::{OllamaChatReq, OllamaMessage, OllamaRole};
use crate::tools::ToolCall;

fn now_ms() -> i64 {
  let dur = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default();
  dur.as_millis() as i64
}

fn openclaw_path(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  crate::settings::resolve_openclaw_bin(app, profile_id)
}

fn profile_dir(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  let base = app.path().app_data_dir().context("app_data_dir not available")?;
  let dir = base.join("profiles").join(profile_id);
  fs::create_dir_all(&dir).context("failed to create profile data dir")?;
  Ok(dir)
}

fn chats_path(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  Ok(profile_dir(app, profile_id)?.join("chats.json"))
}

fn chat_thread_path(app: &AppHandle, profile_id: &str, chat_id: &str) -> Result<PathBuf> {
  Ok(profile_dir(app, profile_id)?.join(format!("chat_{chat_id}.json")))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
  pub id: String,
  pub title: String,
  pub session_id: String,
  pub created_at_ms: i64,
  pub updated_at_ms: i64,
  pub agent_id: Option<String>,
  pub thinking: Option<String>,
  pub worker: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatIndex {
  pub version: i32,
  pub chats: Vec<Chat>,
}

impl Default for ChatIndex {
  fn default() -> Self {
    Self { version: 1, chats: vec![] }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
  User,
  Assistant,
  Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
  pub id: String,
  pub role: ChatRole,
  pub text: String,
  pub created_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatThread {
  pub version: i32,
  pub chat_id: String,
  pub messages: Vec<ChatMessage>,
}

impl ChatThread {
  pub fn new(chat_id: String) -> Self {
    Self { version: 1, chat_id, messages: vec![] }
  }
}

fn load_index(app: &AppHandle, profile_id: &str) -> Result<ChatIndex> {
  let path = chats_path(app, profile_id)?;
  if !path.exists() {
    return Ok(ChatIndex::default());
  }
  let raw = fs::read_to_string(&path).context("failed to read chats.json")?;
  Ok(serde_json::from_str(&raw).context("failed to parse chats.json")?)
}

fn save_index(app: &AppHandle, profile_id: &str, idx: &ChatIndex) -> Result<()> {
  let path = chats_path(app, profile_id)?;
  let raw = serde_json::to_string_pretty(idx).context("failed to serialize chats index")?;
  fs::write(&path, raw).context("failed to write chats.json")?;
  Ok(())
}

fn load_thread(app: &AppHandle, profile_id: &str, chat_id: &str) -> Result<ChatThread> {
  let path = chat_thread_path(app, profile_id, chat_id)?;
  if !path.exists() {
    return Ok(ChatThread::new(chat_id.to_string()));
  }
  let raw = fs::read_to_string(&path).context("failed to read chat thread")?;
  Ok(serde_json::from_str(&raw).context("failed to parse chat thread")?)
}

fn save_thread(app: &AppHandle, profile_id: &str, t: &ChatThread) -> Result<()> {
  let path = chat_thread_path(app, profile_id, &t.chat_id)?;
  let raw = serde_json::to_string_pretty(t).context("failed to serialize chat thread")?;
  fs::write(&path, raw).context("failed to write chat thread")?;
  Ok(())
}

static ID_SEQ: Lazy<AtomicU64> = Lazy::new(|| AtomicU64::new(1));

fn new_id(prefix: &str) -> String {
  let ms = now_ms();
  let seq = ID_SEQ.fetch_add(1, Ordering::Relaxed);
  format!("{prefix}_{ms}_{seq}")
}

static INFLIGHT: Lazy<Mutex<HashSet<String>>> = Lazy::new(|| Mutex::new(HashSet::new()));
static WORKER_LOCKS: Lazy<Mutex<HashMap<String, Arc<Mutex<()>>>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn worker_key(profile_id: &str, worker: &str) -> String {
  format!("{profile_id}::{worker}")
}

fn get_worker_lock(profile_id: &str, worker: &str) -> Arc<Mutex<()>> {
  let key = worker_key(profile_id, worker);
  let mut map = WORKER_LOCKS.lock().unwrap();
  map.entry(key).or_insert_with(|| Arc::new(Mutex::new(()))).clone()
}

fn inflight_key(profile_id: &str, chat_id: &str) -> String {
  format!("{profile_id}::{chat_id}")
}

#[tauri::command]
pub fn chats_list(app: AppHandle, profile_id: String) -> Result<ChatIndex, String> {
  load_index(&app, &profile_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_thread(app: AppHandle, profile_id: String, chat_id: String) -> Result<ChatThread, String> {
  load_thread(&app, &profile_id, &chat_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_reset(app: AppHandle, profile_id: String, chat_id: String) -> Result<ChatThread, String> {
  // Clears thread messages and any inflight state.
  let mut t = ChatThread::new(chat_id.clone());
  save_thread(&app, &profile_id, &t).map_err(|e| e.to_string())?;

  let key = inflight_key(&profile_id, &chat_id);
  if let Ok(mut s) = INFLIGHT.lock() {
    s.remove(&key);
  }

  Ok(t)
}

#[tauri::command]
pub fn chats_create(app: AppHandle, profile_id: String, title: Option<String>) -> Result<Chat, String> {
  let mut idx = load_index(&app, &profile_id).map_err(|e| e.to_string())?;

  let id = new_id("c");
  let session_id = format!("desktop-{}", &id);
  let t = title.unwrap_or_else(|| "New chat".to_string());

  let chat = Chat {
    id: id.clone(),
    title: t,
    session_id,
    created_at_ms: now_ms(),
    updated_at_ms: now_ms(),
    agent_id: None,
    thinking: Some("low".to_string()),
    worker: Some("default".to_string()),
  };

  idx.chats.insert(0, chat.clone());
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;
  // Create empty thread file
  let thread = ChatThread::new(id);
  save_thread(&app, &profile_id, &thread).map_err(|e| e.to_string())?;

  Ok(chat)
}

#[tauri::command]
pub fn chats_rename(app: AppHandle, profile_id: String, chat_id: String, title: String) -> Result<ChatIndex, String> {
  let mut idx = load_index(&app, &profile_id).map_err(|e| e.to_string())?;
  let title = title.trim();
  if title.is_empty() {
    return Err("title required".to_string());
  }
  let c = idx
    .chats
    .iter_mut()
    .find(|c| c.id == chat_id)
    .ok_or_else(|| "chat not found".to_string())?;
  c.title = title.to_string();
  c.updated_at_ms = now_ms();
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;
  Ok(idx)
}

#[tauri::command]
pub fn chats_update(app: AppHandle, profile_id: String, chat_id: String, thinking: Option<String>, agent_id: Option<String>, worker: Option<String>) -> Result<ChatIndex, String> {
  let mut idx = load_index(&app, &profile_id).map_err(|e| e.to_string())?;
  let c = idx
    .chats
    .iter_mut()
    .find(|c| c.id == chat_id)
    .ok_or_else(|| "chat not found".to_string())?;

  c.thinking = thinking.and_then(|t| {
    let x = t.trim().to_string();
    if x.is_empty() { None } else { Some(x) }
  });

  c.agent_id = agent_id.and_then(|a| {
    let x = a.trim().to_string();
    if x.is_empty() { None } else { Some(x) }
  });

  c.worker = worker.and_then(|w| {
    let x = w.trim().to_string();
    if x.is_empty() { None } else { Some(x) }
  });

  c.updated_at_ms = now_ms();
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;
  Ok(idx)
}

#[tauri::command]
pub fn chats_delete(app: AppHandle, profile_id: String, chat_id: String) -> Result<ChatIndex, String> {
  let mut idx = load_index(&app, &profile_id).map_err(|e| e.to_string())?;
  idx.chats.retain(|c| c.id != chat_id);
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;

  // best-effort delete thread file
  if let Ok(p) = chat_thread_path(&app, &profile_id, &chat_id) {
    let _ = fs::remove_file(p);
  }

  Ok(idx)
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentJsonResult {
  result: Option<AgentJsonPayload>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentsListJson {
  agents: Vec<AgentListItem>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentListItem {
  id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentJsonPayload {
  payloads: Vec<AgentPayload>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentPayload {
  text: Option<String>,
}

fn ensure_desktop_agent(app: &AppHandle, bin: PathBuf, openclaw_profile: &str, agent_id: &str, model_id: &str) -> Result<()> {
  // Create tiny workspace (so embedded runs don't inject the huge /Users/.../clawd workspace)
  let ws = crate::desktop_agent::ensure_minimal_workspace(app, &openclaw_profile.replace("ocd-", "p_"))
    .or_else(|_| crate::desktop_agent::ensure_minimal_workspace(app, agent_id))
    .unwrap_or_else(|_| {
      // fallback to app data dir without failing hard
      app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir()).join("workspace")
    });

  let list_args: Vec<String> = vec![
    "--profile".into(),
    openclaw_profile.to_string(),
    "agents".into(),
    "list".into(),
    "--json".into(),
  ];

  let out = crate::openclaw_exec::run_openclaw(app, bin.clone(), list_args).context("agents list")?;
  if out.status.success() {
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    if let Ok(parsed) = serde_json::from_str::<AgentsListJson>(&stdout) {
      if parsed.agents.iter().any(|a| a.id == agent_id) {
        return Ok(());
      }
    }
  }

  // Add agent non-interactively.
  let add_args: Vec<String> = vec![
    "--profile".into(),
    openclaw_profile.to_string(),
    "agents".into(),
    "add".into(),
    "--non-interactive".into(),
    "--workspace".into(),
    ws.to_string_lossy().to_string(),
    "--model".into(),
    model_id.to_string(),
    agent_id.to_string(),
  ];

  let out2 = crate::openclaw_exec::run_openclaw(app, bin, add_args).context("agents add")?;
  if !out2.status.success() {
    let stderr = String::from_utf8_lossy(&out2.stderr).to_string();
    return Err(anyhow::anyhow!(stderr));
  }

  Ok(())
}

fn strip_ollama_prefix(model_id: &str) -> String {
  model_id.strip_prefix("ollama/").unwrap_or(model_id).to_string()
}

fn system_prompt(dev_full_exec_auto: bool, auto_do_mode: bool) -> String {
  let mut s = String::new();
  s.push_str("You are OpenClaw Desktop running locally. You can call tools when needed.\n\n");
  if auto_do_mode {
    s.push_str("AUTO-DO MODE: Enabled. For action requests, you MUST use tools (exec/web_get) rather than giving plans.\n");
    s.push_str("If you claim you did something, it must be backed by tool output.\n\n");
  }

  s.push_str("TOOL CALLS:\n");
  s.push_str("When responding, you may return a single JSON object matching one of these shapes (no extra text):\n");
  s.push_str("- {\"tool\":\"web_get\",\"url\":\"https://example.com\"}\n");
  s.push_str("- {\"tool\":\"exec\",\"cmd\":\"<shell command>\"}\n");
  s.push_str("- {\"tool\":\"final\",\"text\":\"<final answer>\"}\n\n");
  if dev_full_exec_auto {
    s.push_str("EXEC MODE: FULL EXEC AUTO is ENABLED. You may run any shell command you deem necessary. Be careful and prefer read-only commands.\n");
  } else {
    s.push_str("EXEC MODE: restricted. Prefer web_get; avoid exec unless explicitly requested.\n");
  }
  s
}

fn is_action_request(s: &str) -> bool {
  let t = s.to_lowercase();
  let kws = ["do it", "get it done", "fix", "install", "set up", "setup", "run", "execute", "create", "delete", "remove", "update", "build", "deploy"];
  kws.iter().any(|k| t.contains(k))
}

fn base_msgs_for_thread(dev_full_exec_auto: bool, auto_do_mode: bool, thread: &ChatThread, take_last: usize) -> Vec<OllamaMessage> {
  let mut msgs: Vec<OllamaMessage> = vec![OllamaMessage {
    role: OllamaRole::System,
    content: system_prompt(dev_full_exec_auto, auto_do_mode),
  }];

  for m in thread.messages.iter().rev().take(take_last).rev() {
    let role = match m.role {
      ChatRole::User => OllamaRole::User,
      ChatRole::Assistant => OllamaRole::Assistant,
      ChatRole::Tool => OllamaRole::User,
    };
    msgs.push(OllamaMessage { role, content: m.text.clone() });
  }

  if auto_do_mode {
    // If the last user message looks like an action request, force tool-mode.
    if let Some(last_user) = thread.messages.iter().rev().find(|m| matches!(m.role, ChatRole::User)) {
      if is_action_request(&last_user.text) {
        msgs.push(OllamaMessage {
          role: OllamaRole::User,
          content: "AUTO-DO: This is an action request. Reply with a single tool JSON (exec/web_get) to actually do the work. Do not answer with a plan.".to_string(),
        });
      }
    }
  }

  msgs
}

fn run_ollama_with_tools(app: &AppHandle, profile_id: &str, thread: &ChatThread) -> Result<String> {
  let settings = crate::settings::load_settings(app, profile_id).unwrap_or_default();
  let base_url = settings
    .ollama_base_url
    .unwrap_or_else(|| "http://localhost:11434".to_string());
  let model_id = settings
    .ollama_model
    .unwrap_or_else(|| "ollama/huihui_ai/qwen3-abliterated:8b".to_string());
  let model = strip_ollama_prefix(&model_id);
  let dev_full_exec_auto = settings.dev_full_exec_auto.unwrap_or(false);
  let auto_do_mode = settings.auto_do_mode.unwrap_or(false);

  // Keep last N messages.
  let mut msgs: Vec<OllamaMessage> = base_msgs_for_thread(dev_full_exec_auto, auto_do_mode, thread, 16);

  // Tool loop
  for _step in 0..6 {
    let resp = crate::ollama::chat(
      &base_url,
      OllamaChatReq {
        model: model.clone(),
        messages: msgs.clone(),
        stream: false,
      },
    )?;

    let content = resp.message.content;

    if let Ok(call) = serde_json::from_str::<ToolCall>(&content) {
      match call {
        ToolCall::Final { text } => return Ok(text),
        ToolCall::WebGet { url } => {
          let out = crate::tools::web_get(&url).unwrap_or_else(|e| format!("[tool_error] {e}"));
          msgs.push(OllamaMessage { role: OllamaRole::Assistant, content });
          msgs.push(OllamaMessage { role: OllamaRole::User, content: format!("Tool result (web_get):\nURL: {url}\n\n{out}") });
          continue;
        }
        ToolCall::Exec { cmd } => {
          if !dev_full_exec_auto {
            msgs.push(OllamaMessage { role: OllamaRole::Assistant, content });
            msgs.push(OllamaMessage { role: OllamaRole::User, content: "Tool denied: exec is disabled (Developer Mode off). Return a final answer without exec.".to_string() });
            continue;
          }

          let cwd = profile_dir(app, profile_id).unwrap_or_else(|_| std::env::temp_dir());
          let out = crate::tools::exec(&cmd, &cwd).unwrap_or_else(|e| format!("[tool_error] {e}"));
          msgs.push(OllamaMessage { role: OllamaRole::Assistant, content });
          msgs.push(OllamaMessage { role: OllamaRole::User, content: format!("Tool result (exec):\n$ {cmd}\n\n{out}") });
          continue;
        }
      }
    }

    return Ok(content);
  }

  Err(anyhow::anyhow!("tool loop exceeded"))
}

fn stream_ollama_into_thread(app: &AppHandle, profile_id: &str, chat_id: &str, assistant_message_id: &str) -> Result<()> {
  let settings = crate::settings::load_settings(app, profile_id).unwrap_or_default();
  let base_url = settings
    .ollama_base_url
    .unwrap_or_else(|| "http://localhost:11434".to_string());
  let model_id = settings
    .ollama_model
    .unwrap_or_else(|| "ollama/huihui_ai/qwen3-abliterated:8b".to_string());
  let model = strip_ollama_prefix(&model_id);
  let dev_full_exec_auto = settings.dev_full_exec_auto.unwrap_or(false);
  let auto_do_mode = settings.auto_do_mode.unwrap_or(false);

  let thread0 = load_thread(app, profile_id, chat_id).context("load thread")?;
  let mut msgs: Vec<OllamaMessage> = base_msgs_for_thread(dev_full_exec_auto, auto_do_mode, &thread0, 16);

  let mut accumulated = String::new();
  let mut last_persist = Instant::now();

  // up to N steps (tool loop)
  for _step in 0..6 {
    accumulated.clear();

    crate::ollama::chat_stream(
      &base_url,
      OllamaChatReq {
        model: model.clone(),
        messages: msgs.clone(),
        stream: true,
      },
      |delta, done| {
        if !delta.is_empty() {
          accumulated.push_str(&delta);

          let _ = app.emit(
            "chat_stream",
            crate::chat_stream::ChatStreamEvent {
              profile_id: profile_id.to_string(),
              chat_id: chat_id.to_string(),
              message_id: assistant_message_id.to_string(),
              delta: delta.clone(),
              done: false,
              error: None,
              new_role: None,
              new_created_at_ms: None,
            },
          );

          if last_persist.elapsed() > Duration::from_millis(250) {
            let mut t = load_thread(app, profile_id, chat_id).context("reload thread")?;
            if let Some(m) = t.messages.iter_mut().find(|m| m.id == assistant_message_id) {
              m.text.push_str(&delta);
            }
            save_thread(app, profile_id, &t).ok();
            last_persist = Instant::now();
          }
        }

        if done {
          let _ = app.emit(
            "chat_stream",
            crate::chat_stream::ChatStreamEvent {
              profile_id: profile_id.to_string(),
              chat_id: chat_id.to_string(),
              message_id: assistant_message_id.to_string(),
              delta: "".to_string(),
              done: true,
              error: None,
              new_role: None,
              new_created_at_ms: None,
            },
          );
        }

        Ok(())
      },
    )?;

    // Final persist
    let mut t = load_thread(app, profile_id, chat_id).context("reload thread")?;
    if let Some(m) = t.messages.iter_mut().find(|m| m.id == assistant_message_id) {
      // In case we throttled persists, ensure full content is present.
      if !accumulated.is_empty() {
        m.text = accumulated.clone();
      }
    }
    save_thread(app, profile_id, &t).ok();

    // Tool handling
    if let Ok(call) = serde_json::from_str::<ToolCall>(&accumulated) {
      match call {
        ToolCall::Final { text } => {
          let mut t2 = load_thread(app, profile_id, chat_id).context("reload thread")?;
          if let Some(m) = t2.messages.iter_mut().find(|m| m.id == assistant_message_id) {
            m.text = text;
          }
          save_thread(app, profile_id, &t2).ok();
          return Ok(());
        }
        ToolCall::WebGet { url } => {
          let out = crate::tools::web_get(&url).unwrap_or_else(|e| format!("[tool_error] {e}"));
          msgs.push(OllamaMessage { role: OllamaRole::Assistant, content: accumulated.clone() });
          msgs.push(OllamaMessage { role: OllamaRole::User, content: format!("Tool result (web_get):\nURL: {url}\n\n{out}") });
          continue;
        }
        ToolCall::Exec { cmd } => {
          if !dev_full_exec_auto {
            msgs.push(OllamaMessage { role: OllamaRole::Assistant, content: accumulated.clone() });
            msgs.push(OllamaMessage { role: OllamaRole::User, content: "Tool denied: exec is disabled (Developer Mode off). Return a final answer without exec.".to_string() });
            continue;
          }
          let cwd = profile_dir(app, profile_id).unwrap_or_else(|_| std::env::temp_dir());
          let out = crate::tools::exec(&cmd, &cwd).unwrap_or_else(|e| format!("[tool_error] {e}"));

          // Record tool step in thread
          let tool_id = new_id("t");
          {
            let t = load_thread(app, profile_id, chat_id).ok();
            if let Some(mut t) = t {
              t.messages.push(ChatMessage {
                id: tool_id.clone(),
                role: ChatRole::Tool,
                text: format!("exec (cwd={}):\n$ {}\n\n{}", cwd.to_string_lossy(), cmd, out),
                created_at_ms: now_ms(),
              });
              save_thread(app, profile_id, &t).ok();
            }
          }

          let created_at_ms = now_ms();
          let _ = app.emit(
            "chat_stream",
            crate::chat_stream::ChatStreamEvent {
              profile_id: profile_id.to_string(),
              chat_id: chat_id.to_string(),
              message_id: tool_id,
              delta: format!("exec (cwd={}):\n$ {}\n\n{}", cwd.to_string_lossy(), cmd, out),
              done: true,
              error: None,
              new_role: Some("tool".to_string()),
              new_created_at_ms: Some(created_at_ms),
            },
          );

          msgs.push(OllamaMessage { role: OllamaRole::Assistant, content: accumulated.clone() });
          msgs.push(OllamaMessage { role: OllamaRole::User, content: format!("Tool result (exec):\n$ {cmd}\n\n{out}") });
          continue;
        }
      }
    }

    // Not a tool call => final content already streamed.
    return Ok(());
  }

  Err(anyhow::anyhow!("tool loop exceeded"))
}

fn run_agent(app: &AppHandle, bin: PathBuf, openclaw_profile: &str, session_id: &str, message: &str, thinking: Option<&str>, agent_id: Option<&str>) -> Result<String> {
  let mut args: Vec<String> = vec![
    "agent".into(),
    "--local".into(),
    "--session-id".into(),
    session_id.into(),
    "--message".into(),
    message.into(),
    "--json".into(),
    "--channel".into(),
    "last".into(),
    "--timeout".into(),
    "120".into(),
  ];

  if let Some(t) = thinking {
    args.push("--thinking".into());
    args.push(t.into());
  }

  // If no explicit agent provided, use a deterministic per-profile desktop agent.
  let chosen_agent = agent_id.map(|x| x.to_string()).unwrap_or_else(|| crate::desktop_agent::default_agent_id(openclaw_profile));

  args.push("--agent".into());
  args.push(chosen_agent.clone());

  // Prefix with OpenClaw profile so our app profiles stay isolated.
  let mut full_args: Vec<String> = vec!["--profile".into(), openclaw_profile.to_string()];
  full_args.extend(args);

  // Ensure the selected agent exists (creates a minimal-workspace agent by default).
  let model_id = "ollama/huihui_ai/qwen3-abliterated:8b";
  ensure_desktop_agent(app, bin.clone(), openclaw_profile, &chosen_agent, model_id).ok();

  let mut last_err: Option<anyhow::Error> = None;
  for attempt in 0..3 {
    let out = crate::openclaw_exec::run_openclaw(app, bin.clone(), full_args.clone())
      .context("failed to run openclaw agent")?;

    if out.status.success() {
      let stdout = String::from_utf8_lossy(&out.stdout).to_string();
      let parsed: AgentJsonResult = serde_json::from_str(&stdout).context("failed to parse agent JSON")?;
      let text = parsed
        .result
        .and_then(|r| r.payloads.into_iter().find_map(|p| p.text))
        .unwrap_or_else(|| "(no text payload)".to_string());

      return Ok(text);
    }

    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    let err = anyhow::anyhow!(stderr);

    // Handle occasional stale session locks after interrupted runs.
    if err.to_string().contains("session file locked") && attempt < 2 {
      last_err = Some(err);
      thread::sleep(Duration::from_millis(650));
      continue;
    }

    return Err(err);
  }

  Err(last_err.unwrap_or_else(|| anyhow::anyhow!("openclaw agent failed")))
}

#[derive(Debug, Serialize)]
pub struct ChatSendResult {
  pub thread: ChatThread,
}

#[derive(Debug, Serialize)]
pub struct ChatSendStreamResult {
  pub thread: ChatThread,
  pub assistant_message_id: String,
  pub worker: String,
}

#[tauri::command]
pub fn chat_send(app: AppHandle, profile_id: String, chat_id: String, text: String) -> Result<ChatSendResult, String> {
  // Prevent concurrent sends per chat.
  {
    let key = inflight_key(&profile_id, &chat_id);
    let mut s = INFLIGHT.lock().map_err(|_| "inflight lock poisoned".to_string())?;
    if s.contains(&key) {
      return Err("chat is busy (inflight)".to_string());
    }
    s.insert(key);
  }

  let mut idx = load_index(&app, &profile_id).map_err(|e| e.to_string())?;
  let pos = idx
    .chats
    .iter()
    .position(|c| c.id == chat_id)
    .ok_or_else(|| "chat not found".to_string())?;

  let chat_id2 = idx.chats[pos].id.clone();

  let mut thread = load_thread(&app, &profile_id, &chat_id2).map_err(|e| e.to_string())?;

  let msg_user = ChatMessage {
    id: new_id("m"),
    role: ChatRole::User,
    text: text.clone(),
    created_at_ms: now_ms(),
  };
  thread.messages.push(msg_user);

  // Persist user message even if agent call fails.
  idx.chats[pos].updated_at_ms = now_ms();
  save_thread(&app, &profile_id, &thread).map_err(|e| e.to_string())?;
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;

  // Fast path: call Ollama directly (tool loop handled in-process)
  let reply = match run_ollama_with_tools(&app, &profile_id, &thread) {
    Ok(r) => r,
    Err(e) => {
      // Store error as assistant message (keeps UI consistent)
      let msg_ai = ChatMessage {
        id: new_id("m"),
        role: ChatRole::Assistant,
        text: format!("[error] {e:#}"),
        created_at_ms: now_ms(),
      };
      thread.messages.push(msg_ai);
      save_thread(&app, &profile_id, &thread).map_err(|e| e.to_string())?;

      // Clear inflight
      let key = inflight_key(&profile_id, &chat_id);
      if let Ok(mut s) = INFLIGHT.lock() {
        s.remove(&key);
      }

      return Ok(ChatSendResult { thread });
    }
  };

  let msg_ai = ChatMessage {
    id: new_id("m"),
    role: ChatRole::Assistant,
    text: reply,
    created_at_ms: now_ms(),
  };
  thread.messages.push(msg_ai);

  idx.chats[pos].updated_at_ms = now_ms();
  save_thread(&app, &profile_id, &thread).map_err(|e| e.to_string())?;
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;

  // Clear inflight
  let key = inflight_key(&profile_id, &chat_id);
  if let Ok(mut s) = INFLIGHT.lock() {
    s.remove(&key);
  }

  Ok(ChatSendResult { thread })
}

#[tauri::command]
pub fn chat_send_stream(app: AppHandle, profile_id: String, chat_id: String, text: String) -> Result<ChatSendStreamResult, String> {
  // Prevent concurrent sends per chat.
  {
    let key = inflight_key(&profile_id, &chat_id);
    let mut s = INFLIGHT.lock().map_err(|_| "inflight lock poisoned".to_string())?;
    if s.contains(&key) {
      return Err("chat is busy (inflight)".to_string());
    }
    s.insert(key);
  }

  let mut idx = load_index(&app, &profile_id).map_err(|e| e.to_string())?;
  let pos = idx
    .chats
    .iter()
    .position(|c| c.id == chat_id)
    .ok_or_else(|| "chat not found".to_string())?;

  let worker = idx.chats[pos].worker.clone().unwrap_or_else(|| "default".to_string());

  let chat_id2 = idx.chats[pos].id.clone();

  let mut thread = load_thread(&app, &profile_id, &chat_id2).map_err(|e| e.to_string())?;

  let msg_user = ChatMessage {
    id: new_id("m"),
    role: ChatRole::User,
    text: text.clone(),
    created_at_ms: now_ms(),
  };
  thread.messages.push(msg_user);

  // Create placeholder assistant message to stream into.
  let assistant_message_id = new_id("m");
  let msg_ai = ChatMessage {
    id: assistant_message_id.clone(),
    role: ChatRole::Assistant,
    text: "".to_string(),
    created_at_ms: now_ms(),
  };
  thread.messages.push(msg_ai);

  // Persist immediately
  idx.chats[pos].updated_at_ms = now_ms();
  save_thread(&app, &profile_id, &thread).map_err(|e| e.to_string())?;
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;

  // Spawn background streaming task
  let app2 = app.clone();
  let profile_id2 = profile_id.clone();
  let chat_id3 = chat_id2.clone();
  let assistant_id2 = assistant_message_id.clone();
  let worker2 = worker.clone();

  std::thread::spawn(move || {
    // Serialize work per worker.
    let lock = get_worker_lock(&profile_id2, &worker2);
    let _guard = lock.lock().ok();

    let res = stream_ollama_into_thread(&app2, &profile_id2, &chat_id3, &assistant_id2);
    if let Err(e) = res {
      let _ = app2.emit(
        "chat_stream",
        crate::chat_stream::ChatStreamEvent {
          profile_id: profile_id2.clone(),
          chat_id: chat_id3.clone(),
          message_id: assistant_id2.clone(),
          delta: "".to_string(),
          done: true,
          error: Some(e.to_string()),
          new_role: None,
          new_created_at_ms: None,
        },
      );
    }

    // Clear inflight
    let key = inflight_key(&profile_id2, &chat_id3);
    if let Ok(mut s) = INFLIGHT.lock() {
      s.remove(&key);
    }
  });

  Ok(ChatSendStreamResult { thread, assistant_message_id, worker })
}
