use std::path::PathBuf;

use anyhow::Result;
use tauri::AppHandle;

pub struct Openclaw {
  pub bin: PathBuf,
  pub profile: String,
}

pub fn resolve(app: &AppHandle, profile_id: &str) -> Result<Openclaw> {
  let bin = crate::settings::resolve_openclaw_bin(app, profile_id)?;
  let profile = crate::settings::resolve_openclaw_profile(app, profile_id)?;
  Ok(Openclaw { bin, profile })
}

pub fn prefix_args(oc: &Openclaw) -> Vec<String> {
  vec!["--profile".into(), oc.profile.clone()]
}
