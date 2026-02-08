use std::{fs, path::PathBuf};

use anyhow::{Context, Result};
use tauri::{AppHandle, Manager};

fn profile_dir(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  let base = app.path().app_data_dir().context("app_data_dir not available")?;
  let dir = base.join("profiles").join(profile_id);
  fs::create_dir_all(&dir).context("failed to create profile data dir")?;
  Ok(dir)
}

pub fn workspace_dir(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  let dir = profile_dir(app, profile_id)?.join("workspace");
  fs::create_dir_all(&dir).context("failed to create workspace dir")?;
  Ok(dir)
}

pub fn ensure_minimal_workspace(app: &AppHandle, profile_id: &str) -> Result<PathBuf> {
  let dir = workspace_dir(app, profile_id)?;

  // Keep these tiny. The point is to avoid injecting the user's entire /Users/.../clawd workspace.
  let soul = dir.join("SOUL.md");
  if !soul.exists() {
    fs::write(
      &soul,
      "# SOUL\n\nYou are OpenClaw Desktop (local-first). Be direct, concise, and helpful.\n",
    )
    .context("write SOUL.md")?;
  }

  let user = dir.join("USER.md");
  if !user.exists() {
    fs::write(&user, "# USER\n\nName: aashu\n\nNotes: prefers local-first behavior.\n").context("write USER.md")?;
  }

  let mem = dir.join("MEMORY.md");
  if !mem.exists() {
    fs::write(&mem, "# MEMORY\n\n(Desktop profile memory)\n").context("write MEMORY.md")?;
  }

  let agents = dir.join("AGENTS.md");
  if !agents.exists() {
    fs::write(
      &agents,
      "# AGENTS\n\nThis is the OpenClaw Desktop workspace. Prefer small context.\n",
    )
    .context("write AGENTS.md")?;
  }

  Ok(dir)
}

pub fn default_agent_id(profile_id: &str) -> String {
  let safe = profile_id
    .chars()
    .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
    .collect::<String>();
  format!("desktop-{safe}")
}
