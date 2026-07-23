import React, { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupImageUploadProps {
  value?: string | null;
  onChange: (file: File | null, preview: string | null) => void;
  onRemove?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  groupName?: string;
  showRemoveButton?: boolean;
}

export function GroupImageUpload({
  value,
  onChange,
  onRemove,
  disabled,
  size = 'md',
  groupName = '',
  showRemoveButton = true,
}: GroupImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setIsUploading(true);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewUrl = e.target?.result as string;
      setPreview(previewUrl);
      onChange(file, previewUrl);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null, null);
    onRemove?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayImage = preview || value;

  return (
    <div className="relative inline-block">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      <div 
        className={cn(
          "relative cursor-pointer group",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        <Avatar className={cn(sizeClasses[size], "border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors")}>
          {displayImage ? (
            <AvatarImage src={displayImage} className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-muted">
            {isUploading ? (
              <Loader2 className={cn(iconSizeClasses[size], "animate-spin text-muted-foreground")} />
            ) : groupName ? (
              <span className="text-lg font-medium text-muted-foreground">
                {groupName.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <Camera className={cn(iconSizeClasses[size], "text-muted-foreground")} />
            )}
          </AvatarFallback>
        </Avatar>
        
        {/* Overlay on hover */}
        {!isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className={cn(iconSizeClasses[size], "text-white")} />
          </div>
        )}
      </div>

      {/* Remove button */}
      {displayImage && showRemoveButton && !disabled && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
