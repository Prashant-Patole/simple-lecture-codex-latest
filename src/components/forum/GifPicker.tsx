import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface GifPickerProps {
  onGifSelect: (gifUrl: string) => void;
}

interface TenorGif {
  id: string;
  media_formats: {
    gif: { url: string };
    tinygif: { url: string };
  };
}

// Using Tenor's free API (no key required for limited usage)
const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Google's public Tenor API key

export function GifPicker({ onGifSelect }: GifPickerProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 500);

  const fetchGifs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const endpoint = query
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=30&media_filter=gif,tinygif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=30&media_filter=gif,tinygif`;

      const response = await fetch(endpoint);
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Failed to fetch GIFs:', error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifs(debouncedSearch);
  }, [debouncedSearch, fetchGifs]);

  const handleGifClick = (gif: TenorGif) => {
    const gifUrl = gif.media_formats.gif?.url || gif.media_formats.tinygif?.url;
    if (gifUrl) {
      onGifSelect(gifUrl);
    }
  };

  return (
    <div className="flex flex-col h-[350px]">
      <div className="relative p-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search GIFs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="flex-1 px-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No GIFs found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pb-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleGifClick(gif)}
                className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all bg-muted"
              >
                <img
                  src={gif.media_formats.tinygif?.url || gif.media_formats.gif?.url}
                  alt="GIF"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="text-[10px] text-muted-foreground text-center py-1 border-t">
        Powered by Tenor
      </div>
    </div>
  );
}
