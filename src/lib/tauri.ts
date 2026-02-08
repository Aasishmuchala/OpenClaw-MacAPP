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

export async function gatewayStatus(): Promise<GatewayStatus> {
  return invoke("gateway_status");
}

export async function gatewayStart(): Promise<GatewayStatus> {
  return invoke("gateway_start");
}

export async function gatewayStop(): Promise<GatewayStatus> {
  return invoke("gateway_stop");
}

export async function gatewayRestart(): Promise<GatewayStatus> {
  return invoke("gateway_restart");
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

export type ChatRole = "user" | "assistant";

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

export async function chatsDelete(profileId: string, chatId: string): Promise<ChatIndex> {
  return invoke("chats_delete", { profileId, chatId });
}

export async function chatThread(profileId: string, chatId: string): Promise<ChatThread> {
  return invoke("chat_thread", { profileId, chatId });
}

export async function chatSend(profileId: string, chatId: string, text: string): Promise<{ thread: ChatThread }> {
  return invoke("chat_send", { profileId, chatId, text });
}
