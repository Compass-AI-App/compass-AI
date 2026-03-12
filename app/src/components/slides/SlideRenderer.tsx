import { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import SlideLayout from "./SlideLayouts";
import SlideNavigation from "./SlideNavigation";
import type { ContentBlock } from "./SlideLayouts";

interface SlideData {
  title: string;
  layout: string;
  content_blocks: ContentBlock[];
  speaker_notes?: string;
}

interface PresentationData {
  title: string;
  subtitle?: string;
  slides: SlideData[];
}

interface SlideRendererProps {
  presentation: PresentationData;
}

export default function SlideRenderer({ presentation }: SlideRendererProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const slides = presentation.slides;
  const totalSlides = slides.length;

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSlides) {
        setCurrentSlide(index);
      }
    },
    [totalSlides],
  );

  const goPrev = useCallback(
    () => goTo(currentSlide - 1),
    [currentSlide, goTo],
  );
  const goNext = useCallback(
    () => goTo(currentSlide + 1),
    [currentSlide, goTo],
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === " "
      ) {
        e.preventDefault();
        goNext();
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext, isFullscreen]);

  if (totalSlides === 0) {
    return (
      <div className="text-center py-12 text-compass-muted text-sm">
        No slides in this presentation
      </div>
    );
  }

  const slide = slides[currentSlide];

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-compass-bg z-50 flex flex-col">
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
        <div className="shrink-0 bg-compass-card/80 border-t border-compass-border">
          <div className="flex items-center justify-between px-4">
            <SlideNavigation
              currentSlide={currentSlide}
              totalSlides={totalSlides}
              onPrev={goPrev}
              onNext={goNext}
              onGoTo={goTo}
            />
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 text-compass-muted hover:text-compass-text transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
          {slide.speaker_notes && (
            <div className="px-6 pb-3">
              <p className="text-xs text-compass-muted/70 italic">
                {slide.speaker_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-compass-text">
          {presentation.title}
        </h3>
        <button
          onClick={() => setIsFullscreen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 rounded-lg transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
          Present
        </button>
      </div>

      <div className="max-w-3xl mx-auto">
        <SlideLayout
          title={slide.title}
          layout={slide.layout}
          blocks={slide.content_blocks}
        />
      </div>

      <SlideNavigation
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        onPrev={goPrev}
        onNext={goNext}
        onGoTo={goTo}
      />

      {slide.speaker_notes && (
        <div className="max-w-3xl mx-auto px-4 py-2 bg-compass-bg/50 rounded-lg border border-compass-border">
          <p className="text-xs text-compass-muted italic">
            <span className="font-medium text-compass-muted/80">Notes: </span>
            {slide.speaker_notes}
          </p>
        </div>
      )}
    </div>
  );
}

export type { PresentationData, SlideData };
