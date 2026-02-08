use std::{fs, path::PathBuf};

use anyhow::{anyhow, Context, Result};
use tauri::{AppHandle, Manager};

use crate::state::{Profile, ProfilesStore};

fn now_ms() -> i64 {
  let dur = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default();
  dur.as_millis() as i64
}

fn profiles_path(app: &AppHandle) -> Result<PathBuf> {
  let dir = app
    .path()
    .app_data_dir()
    .context("app_data_dir not available")?;
  fs::create_dir_all(&dir).context("failed to create app data dir")?;
  Ok(dir.join("profiles.json"))
}

fn load_store(app: &AppHandle) -> Result<ProfilesStore> {
  let path = profiles_path(app)?;
  if !path.exists() {
    return Ok(ProfilesStore::default());
  }
  let raw = fs::read_to_string(&path).context("failed to read profiles.json")?;
  let store: ProfilesStore = serde_json::from_str(&raw).context("failed to parse profiles.json")?;
  Ok(store)
}

fn save_store(app: &AppHandle, store: &ProfilesStore) -> Result<()> {
  let path = profiles_path(app)?;
  let raw = serde_json::to_string_pretty(store).context("failed to serialize profiles store")?;
  fs::write(&path, raw).context("failed to write profiles.json")?;
  Ok(())
}

fn new_id() -> String {
  // Good enough for local profiles.
  format!("p_{}", now_ms())
}

pub fn ensure_default_profile(app: &AppHandle) -> Result<ProfilesStore> {
  let mut store = load_store(app)?;
  if store.profiles.is_empty() {
    let id = new_id();
    store.profiles.push(Profile {
      id: id.clone(),
      name: "Default".to_string(),
      created_at_ms: now_ms(),
    });
    store.active_profile_id = Some(id);
    save_store(app, &store)?;
  }
  Ok(store)
}

#[tauri::command]
pub fn profiles_list(app: AppHandle) -> Result<ProfilesStore, String> {
  ensure_default_profile(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn profiles_create(app: AppHandle, name: String) -> Result<ProfilesStore, String> {
  let mut store = ensure_default_profile(&app).map_err(|e| e.to_string())?;
  let name = name.trim();
  if name.is_empty() {
    return Err("name required".to_string());
  }
  let id = new_id();
  store.profiles.push(Profile {
    id: id.clone(),
    name: name.to_string(),
    created_at_ms: now_ms(),
  });
  store.active_profile_id = Some(id);
  save_store(&app, &store).map_err(|e| e.to_string())?;
  Ok(store)
}

#[tauri::command]
pub fn profiles_set_active(app: AppHandle, profile_id: String) -> Result<ProfilesStore, String> {
  let mut store = ensure_default_profile(&app).map_err(|e| e.to_string())?;
  let exists = store.profiles.iter().any(|p| p.id == profile_id);
  if !exists {
    return Err("profile not found".to_string());
  }
  store.active_profile_id = Some(profile_id);
  save_store(&app, &store).map_err(|e| e.to_string())?;
  Ok(store)
}

#[tauri::command]
pub fn profiles_rename(app: AppHandle, profile_id: String, name: String) -> Result<ProfilesStore, String> {
  let mut store = ensure_default_profile(&app).map_err(|e| e.to_string())?;
  let name = name.trim();
  if name.is_empty() {
    return Err("name required".to_string());
  }
  let p = store
    .profiles
    .iter_mut()
    .find(|p| p.id == profile_id)
    .ok_or_else(|| "profile not found".to_string())?;
  p.name = name.to_string();
  save_store(&app, &store).map_err(|e| e.to_string())?;
  Ok(store)
}

#[tauri::command]
pub fn profiles_delete(app: AppHandle, profile_id: String) -> Result<ProfilesStore, String> {
  let mut store = ensure_default_profile(&app).map_err(|e| e.to_string())?;
  if store.profiles.len() == 1 {
    return Err("cannot delete last profile".to_string());
  }
  store.profiles.retain(|p| p.id != profile_id);
  if store.active_profile_id.as_deref() == Some(&profile_id) {
    store.active_profile_id = store.profiles.first().map(|p| p.id.clone());
  }
  save_store(&app, &store).map_err(|e| e.to_string())?;
  Ok(store)
}

fn keychain_entry(service: &str, key: &str) -> Result<keyring::Entry> {
  keyring::Entry::new(service, key).map_err(|e| anyhow!(e))
}

#[tauri::command]
pub fn secret_set(profile_id: String, key: String, value: String) -> Result<(), String> {
  let service = format!("openclaw-desktop:{}", profile_id);
  let entry = keychain_entry(&service, &key).map_err(|e| e.to_string())?;
  entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_get(profile_id: String, key: String) -> Result<Option<String>, String> {
  let service = format!("openclaw-desktop:{}", profile_id);
  let entry = keychain_entry(&service, &key).map_err(|e| e.to_string())?;
  match entry.get_password() {
    Ok(v) => Ok(Some(v)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub fn secret_delete(profile_id: String, key: String) -> Result<(), String> {
  let service = format!("openclaw-desktop:{}", profile_id);
  let entry = keychain_entry(&service, &key).map_err(|e| e.to_string())?;
  match entry.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}
