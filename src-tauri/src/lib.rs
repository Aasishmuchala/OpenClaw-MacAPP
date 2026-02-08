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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
