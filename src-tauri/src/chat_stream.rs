use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ChatStreamEvent {
  pub profile_id: String,
  pub chat_id: String,
  pub message_id: String,
  pub delta: String,
  pub done: bool,
  pub error: Option<String>,

  // If present, indicates this event is for a newly created message.
  pub new_role: Option<String>,
  pub new_created_at_ms: Option<i64>,
}
