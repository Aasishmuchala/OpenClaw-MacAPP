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
