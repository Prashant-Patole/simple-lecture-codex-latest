import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StickerPickerProps {
  onStickerSelect: (stickerUrl: string) => void;
}

// Default sticker packs - using emoji-style stickers from Unicode
const STICKER_PACKS = {
  emotions: [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎',
  ],
  gestures: [
    '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
    '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
    '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🙏', '💅', '🤳', '👏',
    '🙌', '👐', '🤲', '🤝', '✍️', '🫶', '🫰', '🫱', '🫲', '🫳',
  ],
  animals: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔',
    '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
    '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟',
  ],
  objects: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
    '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
  ],
  food: [
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
    '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
    '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈',
  ],
};

export function StickerPicker({ onStickerSelect }: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState('emotions');

  const handleStickerClick = (sticker: string) => {
    onStickerSelect(sticker);
  };

  return (
    <div className="h-[350px] flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 mx-2 mt-2">
          <TabsTrigger value="emotions" className="text-lg">😀</TabsTrigger>
          <TabsTrigger value="gestures" className="text-lg">👍</TabsTrigger>
          <TabsTrigger value="animals" className="text-lg">🐶</TabsTrigger>
          <TabsTrigger value="objects" className="text-lg">❤️</TabsTrigger>
          <TabsTrigger value="food" className="text-lg">🍎</TabsTrigger>
        </TabsList>

        {Object.entries(STICKER_PACKS).map(([pack, stickers]) => (
          <TabsContent key={pack} value={pack} className="flex-1 mt-0">
            <ScrollArea className="h-[280px] px-2">
              <div className="grid grid-cols-5 gap-1 py-2">
                {stickers.map((sticker, index) => (
                  <button
                    key={`${pack}-${index}`}
                    onClick={() => handleStickerClick(sticker)}
                    className="p-2 text-3xl hover:bg-muted rounded-lg transition-colors flex items-center justify-center"
                  >
                    {sticker}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
