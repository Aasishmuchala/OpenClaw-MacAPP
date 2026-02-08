use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
  pub id: String,
  pub name: String,
  pub created_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilesStore {
  pub version: i32,
  pub active_profile_id: Option<String>,
  pub profiles: Vec<Profile>,
}

impl Default for ProfilesStore {
  fn default() -> Self {
    Self { version: 1, active_profile_id: None, profiles: vec![] }
  }
}
