import React, { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, X, Upload, Loader2 } from "lucide-react";
import { uploadQuestionImage, extractImagesFromClipboard } from "@/lib/imageUploadHandler";
import { toast } from "sonner";
import { processPastedContent } from "@/lib/wordPasteHandler";

interface RichContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImagesChange?: (images: string[]) => void;
  placeholder?: string;
  label?: string;
  showFormulaSupport?: boolean;
  allowImagePaste?: boolean;
  questionId?: string;
  imageType?: 'question' | 'option_a' | 'option_b' | 'option_c' | 'option_d' | 'explanation';
  currentImages?: string[];
}

export const RichContentEditor: React.FC<RichContentEditorProps> = ({
  value,
  onChange,
  onImagesChange,
  placeholder,
  label,
  showFormulaSupport = false,
  allowImagePaste = true,
  questionId = 'temp',
  imageType = 'question',
  currentImages = [],
}) => {
  const [activeTab, setActiveTab] = useState<"plain" | "latex" | "accounting">("plain");
  const [images, setImages] = useState<string[]>(currentImages);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!allowImagePaste) return;

    const clipboardData = e.clipboardData;
    
    // Check if clipboard contains images
    const hasImage = Array.from(clipboardData.items).some(
      item => item.type.indexOf('image') !== -1
    );

    if (hasImage) {
      e.preventDefault();
      setIsUploading(true);

      try {
        const { text, images: imageFiles } = await extractImagesFromClipboard(clipboardData);
        
        // Upload all images
        const uploadPromises = imageFiles.map(file => 
          uploadQuestionImage(file, questionId, imageType)
        );
        const results = await Promise.all(uploadPromises);

        const uploadedUrls = results
          .filter(result => result.url && !result.error)
          .map(result => result.url);

        if (uploadedUrls.length > 0) {
          const newImages = [...images, ...uploadedUrls];
          setImages(newImages);
          onImagesChange?.(newImages);

          // Add image references to text
          let updatedText = value + (value ? '\n' : '') + text;
          uploadedUrls.forEach((url, index) => {
            updatedText += `\n[Image ${images.length + index + 1}]`;
          });
          onChange(updatedText);

          toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
        }

        const failedUploads = results.filter(result => result.error);
        if (failedUploads.length > 0) {
          toast.error(`Failed to upload ${failedUploads.length} image(s)`);
        }
      } catch (error) {
        console.error('Paste error:', error);
        toast.error('Failed to process pasted content');
      } finally {
        setIsUploading(false);
      }
    } else {
      // Process text with formulas
      const processed = await processPastedContent(e.nativeEvent as ClipboardEvent);
      if (processed.hasFormula) {
        e.preventDefault();
        onChange(value + processed.text);
        if (processed.formulaType && processed.formulaType !== 'plain') {
          toast.info(`Detected ${processed.formulaType} formulas`);
        }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file =>
        uploadQuestionImage(file, questionId, imageType)
      );
      const results = await Promise.all(uploadPromises);

      const uploadedUrls = results
        .filter(result => result.url && !result.error)
        .map(result => result.url);

      if (uploadedUrls.length > 0) {
        const newImages = [...images, ...uploadedUrls];
        setImages(newImages);
        onImagesChange?.(newImages);

        // Add image references to text
        let updatedText = value;
        uploadedUrls.forEach((url, index) => {
          updatedText += `\n[Image ${images.length + index + 1}]`;
        });
        onChange(updatedText);

        toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange?.(newImages);
    
    // Remove image reference from text
    const imageRef = `[Image ${index + 1}]`;
    onChange(value.replace(imageRef, '').trim());
    
    toast.success('Image removed');
  };

  const renderEditor = () => (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder || "Enter text here... You can paste images directly from clipboard"}
        className="min-h-[120px] font-mono"
        disabled={isUploading}
      />
      
      {allowImagePaste && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            Or paste images directly (Ctrl+V)
          </span>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="w-full h-24 object-cover rounded border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                Image {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!showFormulaSupport) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        {renderEditor()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="plain">Plain Text</TabsTrigger>
          <TabsTrigger value="latex">LaTeX (Math/Chem)</TabsTrigger>
          <TabsTrigger value="accounting">Accounting</TabsTrigger>
        </TabsList>
        
        <TabsContent value="plain">
          {renderEditor()}
        </TabsContent>

        <TabsContent value="latex">
          {renderEditor()}
          <p className="text-xs text-muted-foreground mt-2">
            Use LaTeX syntax: $inline$ or $$display$$. Example: $x^2 + y^2 = z^2$
          </p>
        </TabsContent>

        <TabsContent value="accounting">
          {renderEditor()}
          <p className="text-xs text-muted-foreground mt-2">
            Format: Account Name | Debit | Credit (one per line)
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};
