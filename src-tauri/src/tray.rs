use tauri::{AppHandle, Manager, Emitter};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

pub fn init_tray(app: &AppHandle) -> tauri::Result<()> {
  let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
  let new_chat = MenuItem::with_id(app, "new_chat", "New chat", true, None::<&str>)?;
  let restart_gateway = MenuItem::with_id(app, "restart_gateway", "Restart gateway", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

  let menu = Menu::with_items(app, &[&open, &new_chat, &restart_gateway, &quit])?;

  let _tray = TrayIconBuilder::new()
    .menu(&menu)
    .show_menu_on_left_click(true)
    .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: TrayIconEvent| {
      if let TrayIconEvent::Click { .. } = event {
        let app = tray.app_handle();
        let _ = show_main(app);
      }
    })
    .on_menu_event(|app: &AppHandle, ev: tauri::menu::MenuEvent| {
      match ev.id().as_ref() {
        "open" => {
          let _ = show_main(app);
        }
        "new_chat" => {
          let _ = show_main(app);
          let _ = app.emit("tray:new_chat", ());
        }
        "restart_gateway" => {
          let _ = show_main(app);
          let _ = app.emit("tray:restart_gateway", ());
        }
        "quit" => {
          app.exit(0);
        }
        _ => {}
      }
    })
    .build(app)?;

  Ok(())
}

fn show_main(app: &AppHandle) -> tauri::Result<()> {
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.show();
    let _ = w.set_focus();
  }
  Ok(())
}
