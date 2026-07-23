import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { GifPicker } from './GifPicker';
import { StickerPicker } from './StickerPicker';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';

interface MediaPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
  onStickerSelect: (sticker: string) => void;
}

export function MediaPickerSheet({
  open,
  onOpenChange,
  onEmojiSelect,
  onGifSelect,
  onStickerSelect,
}: MediaPickerSheetProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('emoji');

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    onOpenChange(false);
  };

  const handleGifSelect = (gifUrl: string) => {
    onGifSelect(gifUrl);
    onOpenChange(false);
  };

  const handleStickerSelect = (sticker: string) => {
    onStickerSelect(sticker);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[450px] rounded-t-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center">Media</SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="emoji">😊 Emoji</TabsTrigger>
            <TabsTrigger value="gif">GIF</TabsTrigger>
            <TabsTrigger value="sticker">🎨 Stickers</TabsTrigger>
          </TabsList>

          <TabsContent value="emoji" className="mt-2">
            <div className="flex justify-center">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                width="100%"
                height={350}
                searchPlaceholder="Search emoji..."
                previewConfig={{ showPreview: false }}
              />
            </div>
          </TabsContent>

          <TabsContent value="gif" className="mt-2">
            <GifPicker onGifSelect={handleGifSelect} />
          </TabsContent>

          <TabsContent value="sticker" className="mt-2">
            <StickerPicker onStickerSelect={handleStickerSelect} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
