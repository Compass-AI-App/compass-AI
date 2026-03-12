import { useState, useEffect, useCallback } from "react";
import { Minimize2, Clock, MessageSquare } from "lucide-react";
import SlideLayout from "./SlideLayouts";
import SlideNavigation from "./SlideNavigation";
import type { SlideData, PresentationData } from "./SlideRenderer";

interface PresenterViewProps {
  presentation: PresentationData;
  startSlide?: number;
  onExit: () => void;
}

export default function PresenterView({
  presentation,
  startSlide = 0,
  onExit,
}: PresenterViewProps) {
  const [currentSlide, setCurrentSlide] = useState(startSlide);
  const [elapsed, setElapsed] = useState(0);
  const [showNotes, setShowNotes] = useState(true);

  const slides = presentation.slides;
  const totalSlides = slides.length;
  const slide: SlideData = slides[currentSlide];

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSlides) {
        setCurrentSlide(index);
      }
    },
    [totalSlides],
  );

  const goPrev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);
  const goNext = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "Escape") {
        onExit();
      } else if (e.key === "n" || e.key === "N") {
        setShowNotes((s) => !s);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext, onExit]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 bg-compass-bg z-50 flex flex-col">
      {/* Slide area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-5xl">
          <SlideLayout
            title={slide.title}
            layout={slide.layout}
            blocks={slide.content_blocks}
            isPresenting
          />
        </div>
      </div>

      {/* Speaker notes panel */}
      {showNotes && slide.speaker_notes && (
        <div className="bg-compass-card border-t border-compass-border px-8 py-4 max-h-[200px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-compass-accent" />
            <span className="text-xs font-medium text-compass-accent">Speaker Notes</span>
          </div>
          <p className="text-sm text-compass-text/70 leading-relaxed whitespace-pre-wrap">
            {slide.speaker_notes}
          </p>
        </div>
      )}

      {/* Controls bar */}
      <div className="bg-compass-card/80 border-t border-compass-border">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-compass-muted">
              <Clock className="w-3.5 h-3.5" />
              {timeStr}
            </span>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="text-xs text-compass-muted hover:text-compass-text transition-colors"
            >
              {showNotes ? "Hide notes (N)" : "Show notes (N)"}
            </button>
          </div>

          <SlideNavigation
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            onPrev={goPrev}
            onNext={goNext}
            onGoTo={goTo}
          />

          <button
            onClick={onExit}
            className="p-2 text-compass-muted hover:text-compass-text transition-colors"
            title="Exit presenter view (Esc)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
