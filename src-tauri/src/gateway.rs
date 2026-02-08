use std::{path::PathBuf, process::Command};

use anyhow::{Context, Result};
use serde::Serialize;
use tauri::{AppHandle, Manager};

fn openclaw_path() -> PathBuf {
  // In this environment, OpenClaw is installed via nvm global bin.
  // TODO: make configurable in UI.
  PathBuf::from("/Users/aasish/.nvm/versions/node/v22.22.0/bin/openclaw")
}

fn run_openclaw(args: &[&str]) -> Result<(i32, String, String)> {
  let bin = openclaw_path();
  let out = Command::new(bin)
    .args(args)
    .output()
    .with_context(|| format!("failed to run openclaw {}", args.join(" ")))?;

  let code = out.status.code().unwrap_or(-1);
  let stdout = String::from_utf8_lossy(&out.stdout).to_string();
  let stderr = String::from_utf8_lossy(&out.stderr).to_string();
  Ok((code, stdout, stderr))
}

fn logs_dir(app: &AppHandle) -> Result<PathBuf> {
  // Default OpenClaw logs live in ~/.openclaw/logs
  let home = app.path().home_dir().context("home_dir not available")?;
  Ok(home.join(".openclaw").join("logs"))
}

fn tail_file(path: PathBuf, max_lines: usize) -> Result<String> {
  if !path.exists() {
    return Ok(String::new());
  }
  let raw = std::fs::read_to_string(&path).context("failed to read log file")?;
  if max_lines == 0 {
    return Ok(raw);
  }
  let lines: Vec<&str> = raw.lines().collect();
  let start = lines.len().saturating_sub(max_lines);
  Ok(lines[start..].join("\n"))
}

#[derive(Debug, Serialize)]
pub struct GatewayStatus {
  pub exit_code: i32,
  pub stdout: String,
  pub stderr: String,
}

#[tauri::command]
pub fn gateway_status() -> Result<GatewayStatus, String> {
  let (code, stdout, stderr) = run_openclaw(&["gateway", "status"]).map_err(|e| e.to_string())?;
  Ok(GatewayStatus { exit_code: code, stdout, stderr })
}

#[tauri::command]
pub fn gateway_start() -> Result<GatewayStatus, String> {
  let (code, stdout, stderr) = run_openclaw(&["gateway", "start"]).map_err(|e| e.to_string())?;
  Ok(GatewayStatus { exit_code: code, stdout, stderr })
}

#[tauri::command]
pub fn gateway_stop() -> Result<GatewayStatus, String> {
  let (code, stdout, stderr) = run_openclaw(&["gateway", "stop"]).map_err(|e| e.to_string())?;
  Ok(GatewayStatus { exit_code: code, stdout, stderr })
}

#[tauri::command]
pub fn gateway_restart() -> Result<GatewayStatus, String> {
  let (code, stdout, stderr) = run_openclaw(&["gateway", "restart"]).map_err(|e| e.to_string())?;
  Ok(GatewayStatus { exit_code: code, stdout, stderr })
}

#[derive(Debug, Serialize)]
pub struct GatewayLogs {
  pub out: String,
  pub err: String,
}

#[tauri::command]
pub fn gateway_logs(app: AppHandle, lines: Option<u32>) -> Result<GatewayLogs, String> {
  let dir = logs_dir(&app).map_err(|e| e.to_string())?;
  let n = lines.unwrap_or(200) as usize;
  let out = tail_file(dir.join("gateway.log"), n).map_err(|e| e.to_string())?;
  let err = tail_file(dir.join("gateway.err.log"), n).map_err(|e| e.to_string())?;
  Ok(GatewayLogs { out, err })
}
