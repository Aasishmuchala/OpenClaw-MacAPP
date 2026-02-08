use std::{path::PathBuf, process::Command};

use anyhow::{Context, Result};
use tauri::AppHandle;

pub fn canonical(path: &PathBuf) -> PathBuf {
  std::fs::canonicalize(path).unwrap_or_else(|_| path.clone())
}

pub fn run_openclaw(_app: &AppHandle, openclaw_bin: PathBuf, args: Vec<String>) -> Result<std::process::Output> {
  let oc = canonical(&openclaw_bin);

  // If we resolved to a node script (e.g. openclaw.mjs), run it via an explicit node binary.
  if crate::settings::is_node_script(&oc) {
    let node = crate::settings::resolve_node_bin().context("failed to resolve node binary")?;
    return Command::new(node)
      .env("NODE_NO_WARNINGS", "1")
      .env("NODE_OPTIONS", "--no-deprecation")
      .arg(oc)
      .args(args)
      .output()
      .context("failed to run openclaw via node");
  }

  // Otherwise execute the resolved binary, but ensure PATH contains node in case the binary is a shim.
  let node = crate::settings::resolve_node_bin().ok();
  let mut cmd = Command::new(oc);
  cmd.env("NODE_NO_WARNINGS", "1");
  cmd.env("NODE_OPTIONS", "--no-deprecation");
  cmd.args(args);

  if let Some(node) = node {
    if let Some(node_dir) = node.parent() {
      let path = std::env::var("PATH").unwrap_or_default();
      let new_path = format!("{}:{}", node_dir.to_string_lossy(), path);
      cmd.env("PATH", new_path);
    }
  }

  cmd.output().context("failed to run openclaw")
}
