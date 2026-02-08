import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

export async function autostartGet(): Promise<boolean> {
  return isEnabled();
}

export async function autostartSet(on: boolean): Promise<void> {
  if (on) return enable();
  return disable();
}
