import { openUrl } from "@tauri-apps/plugin-opener";

function Item(props: { title: string; why: string; action: () => void }) {
  return (
    <div className="oc-perm">
      <div>
        <div className="oc-perm-title">{props.title}</div>
        <div className="oc-perm-why">{props.why}</div>
      </div>
      <button onClick={props.action}>Open Settings</button>
    </div>
  );
}

export function PermissionsPanel() {
  return (
    <div className="oc-card">
      <div className="oc-card-title">Permissions (guided)</div>
      <div className="oc-card-body">
        <div className="oc-muted">
          macOS requires manual approval for these. We can’t auto-grant them, but we can take you to the right place.
        </div>

        <div className="oc-perm-list">
          <Item
            title="Accessibility"
            why="Needed to control other apps (click/type/menus)"
            action={() => openUrl("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")}
          />
          <Item
            title="Screen Recording"
            why="Needed for reliable UI understanding / screenshots"
            action={() => openUrl("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")}
          />
          <Item
            title="Notifications"
            why="So the app can notify you about long tasks"
            action={() => openUrl("x-apple.systempreferences:com.apple.preference.notifications")}
          />
          <Item
            title="Full Disk Access (optional)"
            why="Only needed if you want the app to read local files outside its sandbox"
            action={() => openUrl("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")}
          />
        </div>
      </div>
    </div>
  );
}
