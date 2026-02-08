use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum ToolCall {
  Exec { cmd: String },
  WebGet { url: String },
  Final { text: String },
}

pub fn exec(cmd: &str, cwd: &std::path::Path) -> Result<String> {
  // zsh -lc for PATH + shell features.
  let out = Command::new("/bin/zsh")
    .current_dir(cwd)
    .arg("-lc")
    .arg(cmd)
    .output()
    .context("failed to spawn shell")?;

  let stdout = String::from_utf8_lossy(&out.stdout).to_string();
  let stderr = String::from_utf8_lossy(&out.stderr).to_string();

  if !out.status.success() {
    return Err(anyhow::anyhow!("exec failed (code {:?}): {}", out.status.code(), stderr.trim()));
  }

  Ok(stdout)
}

pub fn web_get(url: &str) -> Result<String> {
  let resp = reqwest::blocking::get(url).context("web_get failed")?;
  let status = resp.status();
  let text = resp.text().unwrap_or_default();
  if !status.is_success() {
    return Err(anyhow::anyhow!("web_get {}: {}", status, text));
  }
  Ok(text)
}
