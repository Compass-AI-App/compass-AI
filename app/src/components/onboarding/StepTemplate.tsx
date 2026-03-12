import { useState, useEffect } from "react";
import { Building2, Smartphone, Boxes, Store, Wrench, FolderOpen } from "lucide-react";

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommended_sources: string[];
  default_chat_mode: string;
  example_questions: string[];
}

interface StepTemplateProps {
  onSelect: (template: TemplateInfo | null) => void;
  onBack: () => void;
}

const templateIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Smartphone,
  Boxes,
  Store,
  Wrench,
};

export default function StepTemplate({ onSelect, onBack }: StepTemplateProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = (await window.compass.engine.call("/templates", {})) as {
          templates: TemplateInfo[];
        };
        setTemplates(res.templates || []);
      } catch {
        // Templates endpoint may not be available
      }
    })();
  }, []);

  return (
    <div>
      <div className="text-center mb-6">
        <FolderOpen className="w-12 h-12 text-compass-accent mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-compass-text mb-2">
          What are you building?
        </h2>
        <p className="text-sm text-neutral-400">
          Pick a template to get started with recommended sources and questions.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {templates.map((tmpl) => {
          const Icon = templateIcons[tmpl.icon] || Boxes;
          return (
            <button
              key={tmpl.id}
              onClick={() => onSelect(tmpl)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-compass-card border border-compass-border text-left hover:border-compass-accent/50 transition-colors"
            >
              <Icon className="w-5 h-5 text-compass-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-compass-text">{tmpl.name}</p>
                <p className="text-xs text-compass-muted truncate">{tmpl.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="text-sm text-compass-muted hover:text-compass-text"
        >
          Back
        </button>
        <button
          onClick={() => onSelect(null)}
          className="text-sm text-compass-muted hover:text-compass-text border border-compass-border hover:border-compass-accent/50 px-4 py-2 rounded-lg transition-colors"
        >
          Start from Scratch
        </button>
      </div>
    </div>
  );
}
