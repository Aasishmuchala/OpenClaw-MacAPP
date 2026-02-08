import type { ReactNode } from "react";

export function TopBar(props: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="oc-topbar">
      <div className="oc-topbar-left">
        <div className="oc-h1">{props.title}</div>
        <div className="oc-h2">{props.subtitle}</div>
      </div>
      <div className="oc-topbar-right">{props.right}</div>
    </div>
  );
}
