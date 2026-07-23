import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Images } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DocumentImageViewer } from "./DocumentImageViewer";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface PDFPreviewProps {
  pdfUrl: string;
  /** Optional override for the display name. If omitted, we derive it from the URL/path. */
  fileName?: string;
  /** Extracted images from PDF parsing */
  extractedImages?: { url: string; pageNumber?: number }[];
}

export function PDFPreview({ pdfUrl, fileName, extractedImages = [] }: PDFPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartPage, setViewerStartPage] = useState(0);

  // Derive a human-friendly file name from the URL/path if not explicitly provided
  const derivedFileName = fileName || decodeURIComponent(pdfUrl.split("/").pop() || "Document");

  const hasImages = extractedImages.length > 0;

  const handleImageClick = (index: number) => {
    setViewerStartPage(index);
    setViewerOpen(true);
  };

  const handleOpenFullViewer = () => {
    setViewerStartPage(0);
    setViewerOpen(true);
  };

  // If no images available, show a simple message
  if (!hasImages) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground flex-1">
          {derivedFileName}
        </span>
        <span className="text-xs text-muted-foreground">
          No preview available - please re-parse the PDF
        </span>
      </div>
    );
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Images className="h-4 w-4" />
              {isOpen ? "Hide Preview" : "Preview Document"}
              <span className="text-xs text-muted-foreground">
                ({extractedImages.length} pages)
              </span>
            </Button>
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenFullViewer}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Full View
          </Button>
        </div>

        <CollapsibleContent className="mt-4">
          <div className="border rounded-lg overflow-hidden bg-muted/10">
            <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
              <span className="text-sm font-medium">{derivedFileName}</span>
              <span className="text-xs text-muted-foreground">
                {extractedImages.length} pages - Click any page to view full screen
              </span>
            </div>
            
            {/* Thumbnail gallery */}
            <ScrollArea className="w-full">
              <div className="flex gap-3 p-4">
                {extractedImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => handleImageClick(index)}
                    className={cn(
                      "flex-shrink-0 group relative rounded-lg overflow-hidden",
                      "border-2 border-transparent hover:border-primary",
                      "transition-all duration-200 hover:shadow-lg"
                    )}
                  >
                    <img
                      src={img.url}
                      alt={`Page ${index + 1}`}
                      className="h-40 w-auto object-contain bg-white"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
                      Page {index + 1}
                    </div>
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <DocumentImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={extractedImages}
        fileName={derivedFileName}
        initialPage={viewerStartPage}
      />
    </>
  );
}
