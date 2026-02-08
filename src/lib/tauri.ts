import { invoke } from "@tauri-apps/api/core";

export type Profile = {
  id: string;
  name: string;
  created_at_ms: number;
};

export type ProfilesStore = {
  version: number;
  active_profile_id: string | null;
  profiles: Profile[];
};

export async function profilesList(): Promise<ProfilesStore> {
  return invoke("profiles_list");
}

export async function profilesCreate(name: string): Promise<ProfilesStore> {
  return invoke("profiles_create", { name });
}

export async function profilesSetActive(profileId: string): Promise<ProfilesStore> {
  return invoke("profiles_set_active", { profileId });
}

export async function profilesRename(profileId: string, name: string): Promise<ProfilesStore> {
  return invoke("profiles_rename", { profileId, name });
}

export async function profilesDelete(profileId: string): Promise<ProfilesStore> {
  return invoke("profiles_delete", { profileId });
}

export async function secretSet(profileId: string, key: string, value: string): Promise<void> {
  return invoke("secret_set", { profileId, key, value });
}

export async function secretGet(profileId: string, key: string): Promise<string | null> {
  return invoke("secret_get", { profileId, key });
}

export async function secretDelete(profileId: string, key: string): Promise<void> {
  return invoke("secret_delete", { profileId, key });
}

export type GatewayStatus = {
  exit_code: number;
  stdout: string;
  stderr: string;
};

export type GatewayLogs = {
  out: string;
  err: string;
};

export type ProfileSettings = {
  version: number;
  openclaw_path: string | null;
  openclaw_profile?: string | null;
  ollama_base_url?: string | null;
  ollama_model?: string | null;
  dev_full_exec_auto?: boolean | null;
};

export async function settingsGet(profileId: string): Promise<ProfileSettings> {
  return invoke("settings_get", { profileId });
}

export async function settingsSetOpenclawPath(
  profileId: string,
  openclawPath: string | null,
): Promise<ProfileSettings> {
  return invoke("settings_set_openclaw_path", { profileId, openclawPath });
}

export async function settingsSetOllamaBaseUrl(
  profileId: string,
  ollamaBaseUrl: string | null,
): Promise<ProfileSettings> {
  return invoke("settings_set_ollama_base_url", { profileId, ollamaBaseUrl });
}

export async function settingsSetOllamaModel(
  profileId: string,
  ollamaModel: string | null,
): Promise<ProfileSettings> {
  return invoke("settings_set_ollama_model", { profileId, ollamaModel });
}

export async function settingsSetDevFullExecAuto(
  profileId: string,
  enabled: boolean,
): Promise<ProfileSettings> {
  return invoke("settings_set_dev_full_exec_auto", { profileId, enabled });
}

export async function gatewayStatus(profileId: string): Promise<GatewayStatus> {
  return invoke("gateway_status", { profileId });
}

export async function gatewayStart(profileId: string): Promise<GatewayStatus> {
  return invoke("gateway_start", { profileId });
}

export async function gatewayStop(profileId: string): Promise<GatewayStatus> {
  return invoke("gateway_stop", { profileId });
}

export async function gatewayRestart(profileId: string): Promise<GatewayStatus> {
  return invoke("gateway_restart", { profileId });
}

export async function gatewayLogs(lines = 200): Promise<GatewayLogs> {
  return invoke("gateway_logs", { lines });
}

export type Chat = {
  id: string;
  title: string;
  session_id: string;
  created_at_ms: number;
  updated_at_ms: number;
  agent_id: string | null;
  thinking: string | null;
};

export type ChatIndex = {
  version: number;
  chats: Chat[];
};

export type ChatRole = "user" | "assistant" | "tool";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  created_at_ms: number;
};

export type ChatThread = {
  version: number;
  chat_id: string;
  messages: ChatMessage[];
};

export async function chatsList(profileId: string): Promise<ChatIndex> {
  return invoke("chats_list", { profileId });
}

export async function chatsCreate(profileId: string, title?: string): Promise<Chat> {
  return invoke("chats_create", { profileId, title });
}

export async function chatsRename(profileId: string, chatId: string, title: string): Promise<ChatIndex> {
  return invoke("chats_rename", { profileId, chatId, title });
}

export async function chatsUpdate(
  profileId: string,
  chatId: string,
  opts: { thinking?: string | null; agentId?: string | null },
): Promise<ChatIndex> {
  return invoke("chats_update", {
    profileId,
    chatId,
    thinking: opts.thinking ?? null,
    agentId: opts.agentId ?? null,
  });
}

export async function chatsDelete(profileId: string, chatId: string): Promise<ChatIndex> {
  return invoke("chats_delete", { profileId, chatId });
}

export async function chatThread(profileId: string, chatId: string): Promise<ChatThread> {
  return invoke("chat_thread", { profileId, chatId });
}

export async function chatSend(profileId: string, chatId: string, text: string): Promise<{ thread: ChatThread }> {
  return invoke("chat_send", { profileId, chatId, text });
}

export type ChatSendStreamResult = {
  thread: ChatThread;
  assistant_message_id: string;
};

export async function chatSendStream(
  profileId: string,
  chatId: string,
  text: string,
): Promise<ChatSendStreamResult> {
  return invoke("chat_send_stream", { profileId, chatId, text });
}
