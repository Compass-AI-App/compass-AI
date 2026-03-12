import { useState } from "react";
import { Check } from "lucide-react";
import type { PrototypeData } from "./PrototypePreview";

interface VariantComparisonProps {
  variants: PrototypeData[];
  onSelect: (variant: PrototypeData) => void;
  onClose: () => void;
}

export default function VariantComparison({
  variants,
  onSelect,
  onClose,
}: VariantComparisonProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-compass-card border border-compass-border rounded-xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-compass-border">
          <div>
            <h2 className="text-lg font-semibold text-compass-text">
              Compare Variants
            </h2>
            <p className="text-sm text-compass-muted">
              Select the variant you prefer
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIdx !== null && (
              <button
                onClick={() => onSelect(variants[selectedIdx])}
                className="flex items-center gap-1.5 px-4 py-2 bg-compass-accent text-white rounded-lg text-sm font-medium hover:bg-compass-accent/80 transition-colors"
              >
                <Check className="w-4 h-4" />
                Use Variant {String.fromCharCode(65 + selectedIdx)}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-compass-muted hover:text-compass-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${variants.length}, 1fr)`,
            }}
          >
            {variants.map((variant, i) => (
              <div
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`flex flex-col rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedIdx === i
                    ? "border-compass-accent shadow-lg shadow-compass-accent/20"
                    : "border-compass-border hover:border-compass-accent/50"
                }`}
              >
                {/* Label */}
                <div
                  className={`px-4 py-2 text-sm font-medium flex items-center justify-between ${
                    selectedIdx === i
                      ? "bg-compass-accent text-white"
                      : "bg-compass-bg text-compass-text"
                  }`}
                >
                  <span>Variant {String.fromCharCode(65 + i)}</span>
                  {selectedIdx === i && <Check className="w-4 h-4" />}
                </div>

                {/* Preview */}
                <div className="aspect-[4/3] bg-white overflow-hidden relative">
                  <iframe
                    srcDoc={variant.html}
                    sandbox=""
                    className="w-[200%] h-[200%] border-0 origin-top-left pointer-events-none"
                    style={{ transform: "scale(0.5)" }}
                    title={`Variant ${String.fromCharCode(65 + i)}`}
                    tabIndex={-1}
                  />
                </div>

                {/* Description */}
                <div className="px-4 py-3 bg-compass-bg/50">
                  <p className="text-xs text-compass-muted truncate">
                    {variant.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
