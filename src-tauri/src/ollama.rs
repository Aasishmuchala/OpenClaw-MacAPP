use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};

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

#[derive(Debug, Clone, Deserialize)]
pub struct OllamaChatStreamResp {
  pub message: Option<OllamaMessage>,
  pub done: Option<bool>,
}

pub fn chat(base_url: &str, req: OllamaChatReq) -> Result<OllamaChatResp> {
  let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
  let client = Client::builder()
    .timeout(std::time::Duration::from_secs(600))
    .build()
    .context("failed to build http client")?;

  let resp = client
    .post(&url)
    .json(&req)
    .send()
    .with_context(|| format!("ollama /api/chat request failed ({url})"))?;

  if !resp.status().is_success() {
    let status = resp.status();
    let body = resp.text().unwrap_or_default();
    return Err(anyhow::anyhow!("ollama error {}: {}", status, body));
  }

  resp.json::<OllamaChatResp>().context("failed to parse ollama response")
}

pub fn chat_stream<F>(base_url: &str, req: OllamaChatReq, mut on_event: F) -> Result<()>
where
  F: FnMut(String, bool) -> Result<()>,
{
  let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
  let client = Client::builder()
    .timeout(std::time::Duration::from_secs(600))
    .build()
    .context("failed to build http client")?;

  let resp = client
    .post(&url)
    .json(&req)
    .send()
    .with_context(|| format!("ollama /api/chat request failed ({url})"))?;

  if !resp.status().is_success() {
    let status = resp.status();
    let body = resp.text().unwrap_or_default();
    return Err(anyhow::anyhow!("ollama error {}: {}", status, body));
  }

  let mut reader = BufReader::new(resp);
  let mut line = String::new();
  loop {
    line.clear();
    let n = reader.read_line(&mut line).context("failed to read ollama stream")?;
    if n == 0 {
      break;
    }
    let trimmed = line.trim();
    if trimmed.is_empty() {
      continue;
    }

    let ev: OllamaChatStreamResp = serde_json::from_str(trimmed).context("failed to parse ollama stream json")?;
    let done = ev.done.unwrap_or(false);
    let delta = ev
      .message
      .and_then(|m| Some(m.content))
      .unwrap_or_else(|| "".to_string());

    if !delta.is_empty() || done {
      on_event(delta, done)?;
    }

    if done {
      break;
    }
  }

  Ok(())
}
