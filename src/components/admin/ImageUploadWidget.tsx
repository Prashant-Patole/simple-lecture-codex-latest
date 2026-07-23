import { useState, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ImageUploadWidgetProps {
  label: string;
  value?: string;
  onChange: (url: string | null) => void;
  onFileSelect: (file: File) => Promise<string>;
  className?: string;
}

export const ImageUploadWidget = ({
  label,
  value,
  onChange,
  onFileSelect,
  className,
}: ImageUploadWidgetProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        setIsUploading(true);
        try {
          const url = await onFileSelect(file);
          onChange(url);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onFileSelect, onChange]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsUploading(true);
        try {
          const url = await onFileSelect(file);
          onChange(url);
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onFileSelect, onChange]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">{label}</label>
      
      {value ? (
        <Card className="relative">
          <img
            src={value}
            alt={label}
            className="w-full h-48 object-cover rounded-md"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </Card>
      ) : (
        <Card
          className={cn(
            "border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
            isDragging && "border-primary bg-primary/5",
            isUploading && "pointer-events-none opacity-50"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`file-input-${label}`)?.click()}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop an image or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Max 5MB, JPG/PNG/WEBP
              </p>
            </div>
          )}
          <input
            id={`file-input-${label}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </Card>
      )}
    </div>
  );
};
