use std::{fs, path::PathBuf, process::Command};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

fn now_ms() -> i64 {
  let dur = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default();
  dur.as_millis() as i64
}

fn openclaw_path() -> PathBuf {
  PathBuf::from("/Users/aasish/.nvm/versions/node/v22.22.0/bin/openclaw")
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

fn new_id(prefix: &str) -> String {
  format!("{prefix}_{}", now_ms())
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
struct AgentJsonPayload {
  payloads: Vec<AgentPayload>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentPayload {
  text: Option<String>,
}

fn run_agent(session_id: &str, message: &str, thinking: Option<&str>, agent_id: Option<&str>) -> Result<String> {
  let mut args: Vec<String> = vec![
    "agent".into(),
    "--session-id".into(),
    session_id.into(),
    "--message".into(),
    message.into(),
    "--json".into(),
    "--channel".into(),
    "last".into(),
  ];

  if let Some(t) = thinking {
    args.push("--thinking".into());
    args.push(t.into());
  }

  if let Some(a) = agent_id {
    args.push("--agent".into());
    args.push(a.into());
  }

  let out = Command::new(openclaw_path())
    .args(args)
    .output()
    .context("failed to run openclaw agent")?;

  if !out.status.success() {
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    return Err(anyhow::anyhow!(stderr));
  }

  let stdout = String::from_utf8_lossy(&out.stdout).to_string();
  let parsed: AgentJsonResult = serde_json::from_str(&stdout).context("failed to parse agent JSON")?;
  let text = parsed
    .result
    .and_then(|r| r.payloads.into_iter().find_map(|p| p.text))
    .unwrap_or_else(|| "(no text payload)".to_string());

  Ok(text)
}

#[derive(Debug, Serialize)]
pub struct ChatSendResult {
  pub thread: ChatThread,
}

#[tauri::command]
pub fn chat_send(app: AppHandle, profile_id: String, chat_id: String, text: String) -> Result<ChatSendResult, String> {
  let mut idx = load_index(&app, &profile_id).map_err(|e| e.to_string())?;
  let chat = idx
    .chats
    .iter_mut()
    .find(|c| c.id == chat_id)
    .ok_or_else(|| "chat not found".to_string())?;

  let mut thread = load_thread(&app, &profile_id, &chat.id).map_err(|e| e.to_string())?;

  let msg_user = ChatMessage {
    id: new_id("m"),
    role: ChatRole::User,
    text: text.clone(),
    created_at_ms: now_ms(),
  };
  thread.messages.push(msg_user);

  // call OpenClaw
  let reply = run_agent(
    &chat.session_id,
    &text,
    chat.thinking.as_deref(),
    chat.agent_id.as_deref(),
  )
  .map_err(|e| e.to_string())?;

  let msg_ai = ChatMessage {
    id: new_id("m"),
    role: ChatRole::Assistant,
    text: reply,
    created_at_ms: now_ms(),
  };
  thread.messages.push(msg_ai);

  chat.updated_at_ms = now_ms();
  save_thread(&app, &profile_id, &thread).map_err(|e| e.to_string())?;
  save_index(&app, &profile_id, &idx).map_err(|e| e.to_string())?;

  Ok(ChatSendResult { thread })
}
