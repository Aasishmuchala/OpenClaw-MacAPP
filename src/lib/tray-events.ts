import { listen } from "@tauri-apps/api/event";

export async function onTrayNewChat(cb: () => void) {
  return listen("tray:new_chat", () => cb());
}

export async function onTrayRestartGateway(cb: () => void) {
  return listen("tray:restart_gateway", () => cb());
}
