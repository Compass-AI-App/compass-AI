import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}

export default function SlideNavigation({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  onGoTo,
}: SlideNavigationProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <button
        onClick={onPrev}
        disabled={currentSlide === 0}
        className={clsx(
          "p-1.5 rounded-lg transition-colors",
          currentSlide === 0
            ? "text-compass-muted/30"
            : "text-compass-muted hover:text-compass-text hover:bg-white/5",
        )}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSlides }, (_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            className={clsx(
              "w-2 h-2 rounded-full transition-all",
              i === currentSlide
                ? "bg-compass-accent w-6"
                : "bg-compass-muted/30 hover:bg-compass-muted/60",
            )}
          />
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={currentSlide === totalSlides - 1}
        className={clsx(
          "p-1.5 rounded-lg transition-colors",
          currentSlide === totalSlides - 1
            ? "text-compass-muted/30"
            : "text-compass-muted hover:text-compass-text hover:bg-white/5",
        )}
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <span className="text-xs text-compass-muted ml-2">
        {currentSlide + 1} / {totalSlides}
      </span>
    </div>
  );
}
