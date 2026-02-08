import { invoke } from "@tauri-apps/api/core";

export type ModelsStatus = {
  exit_code: number;
  stdout: string;
  stderr: string;
};

export async function modelsStatus(profileId: string): Promise<ModelsStatus> {
  return invoke("models_status", { profileId });
}

export async function modelsSetDefault(profileId: string, model: string): Promise<ModelsStatus> {
  return invoke("models_set_default", { profileId, model });
}
