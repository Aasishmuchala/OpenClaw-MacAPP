mod chats;
mod gateway;
mod profiles;
mod settings;
mod state;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            tray::init_tray(&app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            profiles::profiles_list,
            profiles::profiles_create,
            profiles::profiles_set_active,
            profiles::profiles_rename,
            profiles::profiles_delete,
            profiles::secret_set,
            profiles::secret_get,
            profiles::secret_delete,
            settings::settings_get,
            settings::settings_set_openclaw_path,
            gateway::gateway_status,
            gateway::gateway_start,
            gateway::gateway_stop,
            gateway::gateway_restart,
            gateway::gateway_logs,
            chats::chats_list,
            chats::chats_create,
            chats::chats_rename,
            chats::chats_delete,
            chats::chat_thread,
            chats::chat_send,
            chats::chats_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
