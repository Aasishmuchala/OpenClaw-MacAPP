# OpenClaw Mac App (Desktop)

Local-first macOS desktop app for OpenClaw.

## Goals (MVP)

- Runs on login (Launch at Login toggle)
- Multiple local profiles (isolated chats/config/auth)
- Multiple chats (session-based)
- Per-chat model selection (only for configured/allowed models)
- Embedded Gateway manager (start/stop/restart, status, logs)
- Permissions dashboard (guided; macOS requires user approval)

## Dev prerequisites

Tauri requires Rust.

- Install Rust: https://www.rust-lang.org/tools/install
- macOS prerequisites: https://tauri.app/start/prerequisites/

## Run

```bash
npm install
npm run tauri dev
```

## Notes

### Default model (current)

For now we’re using a **local Ollama model**:

- `huihui_ai/qwen3-vl-abliterated:8b`

We’ll hook up ChatGPT/Gemini/GitHub-backed models later once provider auth + allowlists are wired cleanly.

- This app is intended to be distributed **outside the Mac App Store** (signed + notarized).
- Secrets should be stored in **Keychain** (no plaintext tokens).
