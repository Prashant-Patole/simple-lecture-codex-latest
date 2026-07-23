import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Loader2,
  X,
  Maximize2,
  Minimize2,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentImage {
  url: string;
  pageNumber?: number;
  label?: string;
}

interface DocumentImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  images: DocumentImage[];
  fileName?: string;
  initialPage?: number;
}

export function DocumentImageViewer({
  isOpen,
  onClose,
  images,
  fileName = "Document",
  initialPage = 0,
}: DocumentImageViewerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to top-left of the image viewer
  const scrollToTop = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, []);

  // Reset view: zoom to 1 and scroll to top
  const handleResetView = useCallback(() => {
    setZoom(1);
    setTimeout(scrollToTop, 50);
  }, [scrollToTop]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(initialPage);
      setZoom(1);
      setLoadedImages(new Set());
      setLoadingImages(new Set());
      setTimeout(scrollToTop, 100);
    }
  }, [isOpen, initialPage, scrollToTop]);

  // Scroll to top when page changes
  useEffect(() => {
    if (isOpen) {
      scrollToTop();
    }
  }, [currentPage, isOpen, scrollToTop]);

  const handlePrevious = useCallback(() => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentPage((prev) => Math.min(images.length - 1, prev + 1));
  }, [images.length]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(3, prev + 0.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.5, prev - 0.25));
  }, []);

  const handleImageLoad = useCallback((index: number) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setLoadedImages((prev) => new Set(prev).add(index));
  }, []);

  const handleImageLoadStart = useCallback((index: number) => {
    if (!loadedImages.has(index)) {
      setLoadingImages((prev) => new Set(prev).add(index));
    }
  }, [loadedImages]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "Escape":
          if (isFullScreen) {
            setIsFullScreen(false);
          } else {
            onClose();
          }
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFullScreen, handlePrevious, handleNext, handleZoomIn, handleZoomOut, onClose]);

  if (images.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{fileName}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            No images available for this document.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentImage = images[currentPage];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "flex flex-col gap-0 p-0",
          isFullScreen 
            ? "max-w-[100vw] max-h-[100vh] w-screen h-screen rounded-none" 
            : "max-w-4xl max-h-[90vh] w-[90vw]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-medium">
              {fileName}
            </DialogTitle>
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {images.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Zoom controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="h-8 w-8"
              title="Zoom out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="h-8 w-8"
              title="Zoom in (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            {/* Reset view */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetView}
              className="h-8 w-8"
              title="Reset view"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8"
            >
              {isFullScreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image viewer */}
        <div className="flex-1 relative overflow-hidden bg-muted/30">
          <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
            <div 
              className="flex items-start justify-center min-h-full p-4"
              style={{ minHeight: isFullScreen ? "calc(100vh - 120px)" : "500px" }}
            >
              {loadingImages.has(currentPage) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <img
                src={currentImage.url}
                alt={currentImage.label || `Page ${currentPage + 1}`}
                className={cn(
                  "block max-w-full w-auto h-auto object-contain transition-transform duration-200",
                  isFullScreen ? "max-h-[calc(100vh-140px)]" : "max-h-[calc(90vh-180px)]"
                )}
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center"
                }}
                onLoadStart={() => handleImageLoadStart(currentPage)}
                onLoad={() => handleImageLoad(currentPage)}
                onError={() => handleImageLoad(currentPage)}
              />
            </div>
          </ScrollArea>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={handlePrevious}
                disabled={currentPage === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleNext}
                disabled={currentPage === images.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Page thumbnails */}
        {images.length > 1 && (
          <div className="border-t bg-card px-4 py-2">
            <ScrollArea className="w-full">
              <div className="flex gap-2 py-1">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={cn(
                      "flex-shrink-0 rounded border-2 overflow-hidden transition-all",
                      index === currentPage 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <img
                      src={img.url}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-16 w-12 object-cover bg-muted"
                    />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
