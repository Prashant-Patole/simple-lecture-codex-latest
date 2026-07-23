import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { isBareFilename, resolveQuestionImageUrl } from '@/lib/imageResolver';

export const ResolvedImage = ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (src && isBareFilename(src)) {
      setIsLoading(true);
      setHasError(false);
      resolveQuestionImageUrl(src).then((url) => {
        setResolvedUrl(url);
        setIsLoading(false);
        if (!url) setHasError(true);
      });
    }
  }, [src]);

  if (isLoading) {
    return <Skeleton className="w-full h-32 rounded-md" />;
  }

  if (hasError) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs text-muted-foreground border">
        🖼️ {alt || src || 'Image not found'}
      </div>
    );
  }

  const finalSrc = resolvedUrl || src;

  return (
    <div className="overflow-hidden max-w-full">
      <img
        src={finalSrc}
        alt={alt || ''}
        className="max-w-full w-auto h-auto rounded-md my-2 block"
        onError={() => setHasError(true)}
        {...props}
      />
    </div>
  );
};
