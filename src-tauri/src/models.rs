use anyhow::{Context, Result};
use serde::Serialize;
use tauri::AppHandle;

fn run_openclaw(app: &AppHandle, bin: std::path::PathBuf, args: Vec<String>) -> Result<(i32, String, String)> {
  let out = crate::openclaw_exec::run_openclaw(app, bin, args.clone())
    .with_context(|| format!("failed to run openclaw {}", args.join(" ")))?;
  let code = out.status.code().unwrap_or(-1);
  let stdout = String::from_utf8_lossy(&out.stdout).to_string();
  let stderr = String::from_utf8_lossy(&out.stderr).to_string();
  Ok((code, stdout, stderr))
}

#[derive(Debug, Serialize)]
pub struct ModelsStatus {
  pub exit_code: i32,
  pub stdout: String,
  pub stderr: String,
}

fn prefix_args(app: &AppHandle, profile_id: &str) -> Result<Vec<String>> {
  let bin = crate::settings::resolve_openclaw_bin(app, profile_id)?;
  let prof = crate::settings::resolve_openclaw_profile(app, profile_id)?;
  Ok(vec![
    bin.to_string_lossy().to_string(),
    "--profile".into(),
    prof,
  ])
}

#[tauri::command]
pub fn models_status(app: AppHandle, profile_id: String) -> Result<ModelsStatus, String> {
  let bin = crate::settings::resolve_openclaw_bin(&app, &profile_id).map_err(|e| e.to_string())?;
  let prof = crate::settings::resolve_openclaw_profile(&app, &profile_id).map_err(|e| e.to_string())?;
  let args: Vec<String> = vec![
    "--profile".into(),
    prof,
    "models".into(),
    "status".into(),
    "--status-plain".into(),
  ];
  let (code, stdout, stderr) = run_openclaw(&app, bin, args).map_err(|e| e.to_string())?;
  Ok(ModelsStatus { exit_code: code, stdout, stderr })
}

#[tauri::command]
pub fn models_set_default(app: AppHandle, profile_id: String, model: String) -> Result<ModelsStatus, String> {
  let bin = crate::settings::resolve_openclaw_bin(&app, &profile_id).map_err(|e| e.to_string())?;
  let prof = crate::settings::resolve_openclaw_profile(&app, &profile_id).map_err(|e| e.to_string())?;
  let model = model.trim().to_string();
  if model.is_empty() {
    return Err("model required".into());
  }
  let args: Vec<String> = vec![
    "--profile".into(),
    prof,
    "models".into(),
    "set".into(),
    model,
  ];
  let (code, stdout, stderr) = run_openclaw(&app, bin, args).map_err(|e| e.to_string())?;
  Ok(ModelsStatus { exit_code: code, stdout, stderr })
}
