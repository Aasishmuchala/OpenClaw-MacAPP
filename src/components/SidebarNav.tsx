import type { ReactNode } from "react";

export type SectionKey = "chats" | "gateway" | "models" | "permissions" | "settings";

const LABELS: Record<SectionKey, string> = {
  chats: "Chats",
  gateway: "Gateway",
  models: "Models",
  permissions: "Permissions",
  settings: "Settings",
};

function Item(props: { active: boolean; label: string; onClick: () => void; disabled?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={`oc-nav-item ${props.active ? "active" : ""}`}
      aria-current={props.active ? "page" : undefined}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <span className="oc-nav-label">{props.label}</span>
    </button>
  );
}

export function SidebarNav(props: { value: SectionKey; onChange: (v: SectionKey) => void; disabled?: boolean }) {
  const items: SectionKey[] = ["chats", "gateway", "models", "permissions", "settings"];

  return (
    <nav className="oc-nav" aria-label="Sections">
      {items.map((k) => (
        <Item
          key={k}
          label={LABELS[k]}
          active={props.value === k}
          disabled={props.disabled}
          onClick={() => props.onChange(k)}
        />
      ))}
    </nav>
  );
}
