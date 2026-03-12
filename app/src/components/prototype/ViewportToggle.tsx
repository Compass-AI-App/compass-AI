import { Monitor, Tablet, Smartphone } from "lucide-react";
import { clsx } from "clsx";

export type Viewport = "desktop" | "tablet" | "mobile";

interface ViewportToggleProps {
  viewport: Viewport;
  onChange: (viewport: Viewport) => void;
}

const VIEWPORTS: { id: Viewport; icon: typeof Monitor; label: string; width: string }[] = [
  { id: "desktop", icon: Monitor, label: "Desktop", width: "100%" },
  { id: "tablet", icon: Tablet, label: "Tablet (768px)", width: "768px" },
  { id: "mobile", icon: Smartphone, label: "Mobile (375px)", width: "375px" },
];

export function getViewportWidth(viewport: Viewport): string {
  return VIEWPORTS.find((v) => v.id === viewport)?.width ?? "100%";
}

export default function ViewportToggle({ viewport, onChange }: ViewportToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-compass-bg/50 rounded-lg p-1">
      {VIEWPORTS.map((v) => {
        const Icon = v.icon;
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            title={v.label}
            className={clsx(
              "p-1.5 rounded transition-colors",
              viewport === v.id
                ? "bg-compass-accent text-white"
                : "text-compass-muted hover:text-compass-text",
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
