import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface MathpixPreviewProps {
  mmdText: string;
  className?: string;
}

export const MathpixPreview = ({ mmdText, className }: MathpixPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderMMD = async () => {
      if (!containerRef.current || !mmdText) return;

      try {
        setIsLoading(true);
        setError(null);

        // Simple fallback rendering - just display as pre-formatted text
        // TODO: Add proper Mathpix rendering when library is fully integrated
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="whitespace-pre-wrap">${mmdText}</pre>`;
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error rendering MMD:', err);
        setError('Failed to render document preview');
        setIsLoading(false);
      }
    };

    renderMMD();
  }, [mmdText]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Document Preview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Rendering preview...</span>
          </div>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div 
          ref={containerRef} 
          className="mathpix-content prose prose-sm max-w-none"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </CardContent>
    </Card>
  );
};
