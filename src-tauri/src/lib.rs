mod chats;
mod gateway;
mod profiles;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            profiles::profiles_list,
            profiles::profiles_create,
            profiles::profiles_set_active,
            profiles::profiles_rename,
            profiles::profiles_delete,
            profiles::secret_set,
            profiles::secret_get,
            profiles::secret_delete,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
