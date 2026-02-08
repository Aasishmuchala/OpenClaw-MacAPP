use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OllamaRole {
  System,
  User,
  Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaMessage {
  pub role: OllamaRole,
  pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OllamaChatReq {
  pub model: String,
  pub messages: Vec<OllamaMessage>,
  #[serde(default)]
  pub stream: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OllamaChatResp {
  pub message: OllamaMessage,
}

pub fn chat(base_url: &str, req: OllamaChatReq) -> Result<OllamaChatResp> {
  let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
  let client = Client::new();

  let resp = client
    .post(url)
    .json(&req)
    .send()
    .context("ollama /api/chat request failed")?;

  if !resp.status().is_success() {
    let status = resp.status();
    let body = resp.text().unwrap_or_default();
    return Err(anyhow::anyhow!("ollama error {}: {}", status, body));
  }

  resp.json::<OllamaChatResp>().context("failed to parse ollama response")
}
