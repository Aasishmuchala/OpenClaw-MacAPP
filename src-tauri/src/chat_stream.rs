use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ChatStreamEvent {
  pub profile_id: String,
  pub chat_id: String,
  pub message_id: String,
  pub delta: String,
  pub done: bool,
  pub error: Option<String>,
}
