use std::{fs, path::PathBuf, process::Command};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

fn profile_dir(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  let base = app.path().app_data_dir().context("app_data_dir not available")?;
  let dir = base.join("profiles").join(profile_id);
  fs::create_dir_all(&dir).context("failed to create profile data dir")?;
  Ok(dir)
}

fn settings_path(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  Ok(profile_dir(app, profile_id)?.join("settings.json"))
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProfileSettings {
  pub version: i32,
  pub openclaw_path: Option<String>,
  pub openclaw_profile: Option<String>,
}

pub fn load_settings(app: &AppHandle, profile_id: &str) -> Result<ProfileSettings> {
  let path = settings_path(app, profile_id)?;
  if !path.exists() {
    return Ok(ProfileSettings { version: 1, openclaw_path: None, openclaw_profile: None });
  }
  let raw = fs::read_to_string(&path).context("failed to read settings.json")?;
  let mut s: ProfileSettings = serde_json::from_str(&raw).context("failed to parse settings.json")?;
  if s.version == 0 {
    s.version = 1;
  }
  // backfill
  if s.openclaw_profile.is_none() {
    s.openclaw_profile = None;
  }
  Ok(s)
}

pub fn save_settings(app: &AppHandle, profile_id: &str, s: &ProfileSettings) -> Result<()> {
  let path = settings_path(app, profile_id)?;
  let raw = serde_json::to_string_pretty(s).context("failed to serialize settings")?;
  fs::write(&path, raw).context("failed to write settings.json")?;
  Ok(())
}

fn which(cmd: &str) -> Result<Option<String>> {
  let out = Command::new("/usr/bin/which").arg(cmd).output();
  match out {
    Ok(o) if o.status.success() => {
      let p = String::from_utf8_lossy(&o.stdout).trim().to_string();
      if p.is_empty() {
        Ok(None)
      } else {
        Ok(Some(p))
      }
    }
    _ => Ok(None),
  }
}

pub fn resolve_node_bin() -> Result<PathBuf> {
  if let Some(p) = which("node")? {
    return Ok(PathBuf::from(p));
  }

  // Prefer Homebrew node if present.
  let brew = PathBuf::from("/opt/homebrew/bin/node");
  if brew.exists() {
    return Ok(brew);
  }

  // Fallback to the known NVM location in this environment.
  Ok(PathBuf::from("/Users/aasish/.nvm/versions/node/v22.22.0/bin/node"))
}

pub fn is_node_script(path: &PathBuf) -> bool {
  let s = path.to_string_lossy();
  s.ends_with(".mjs") || s.ends_with(".js")
}

pub fn resolve_openclaw_bin(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  let s = load_settings(app, profile_id).unwrap_or_default();
  if let Some(p) = s.openclaw_path {
    return Ok(PathBuf::from(p));
  }

  if let Some(p) = which("openclaw")? {
    return Ok(PathBuf::from(p));
  }

  // Fallback to the known location in this environment.
  Ok(PathBuf::from("/Users/aasish/.nvm/versions/node/v22.22.0/bin/openclaw"))
}

pub fn resolve_openclaw_profile(app: &AppHandle, profile_id: &str) -> Result<String> {
  let s = load_settings(app, profile_id).unwrap_or_default();
  if let Some(p) = s.openclaw_profile {
    let t = p.trim().to_string();
    if !t.is_empty() {
      return Ok(t);
    }
  }

  // Derive a stable profile name from our local profile id.
  // Keep it short-ish and filesystem-safe.
  let safe = profile_id
    .chars()
    .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
    .collect::<String>();
  Ok(format!("ocd-{safe}"))
}

#[tauri::command]
pub fn settings_get(app: AppHandle, profile_id: String) -> Result<ProfileSettings, String> {
  load_settings(&app, &profile_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_set_openclaw_path(app: AppHandle, profile_id: String, openclaw_path: Option<String>) -> Result<ProfileSettings, String> {
  let mut s = load_settings(&app, &profile_id).unwrap_or(ProfileSettings { version: 1, openclaw_path: None, openclaw_profile: None });
  s.version = 1;
  s.openclaw_path = openclaw_path.and_then(|x| {
    let t = x.trim().to_string();
    if t.is_empty() { None } else { Some(t) }
  });
  save_settings(&app, &profile_id, &s).map_err(|e| e.to_string())?;
  Ok(s)
}
