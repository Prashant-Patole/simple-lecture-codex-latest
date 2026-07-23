import { useState, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, X, Loader2, Smile } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { MediaPickerSheet } from './MediaPickerSheet';

export type MessageType = 'text' | 'image' | 'file' | 'system' | 'emoji' | 'sticker' | 'gif';

interface MessageInputProps {
  onSend: (content: string, fileUrl?: string, messageType?: MessageType) => Promise<void>;
  onTyping: () => void;
  replyTo: { id: string; content: string; senderName: string } | null;
  onCancelReply: () => void;
  groupId: string;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  groupId,
  disabled,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if ((!message.trim() && !uploading) || disabled) return;
    
    await onSend(message, undefined, 'text');
    setMessage('');
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const handleEmojiSend = (emoji: string) => {
    // Send large emoji as sticker type
    onSend(emoji, undefined, 'sticker');
  };

  const handleGifSelect = async (gifUrl: string) => {
    await onSend('', gifUrl, 'gif');
  };

  const handleStickerSelect = async (sticker: string) => {
    await onSend(sticker, undefined, 'sticker');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping();
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${groupId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(data.path);

      await onSend(file.name, publicUrl);
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="border-t bg-card p-3">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 mb-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-primary font-medium">
              Replying to {replyTo.senderName}
            </span>
            <p className="text-sm text-muted-foreground truncate">
              {replyTo.content}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancelReply} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attachment */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
          className="flex-shrink-0"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </Button>

        {/* Emoji picker - desktop */}
        <div className="hidden sm:block">
          <EmojiPickerPopover onEmojiSelect={handleEmojiSelect} disabled={disabled} />
        </div>

        {/* Media picker button - mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowMediaPicker(true)}
          disabled={disabled}
          className="flex-shrink-0 sm:hidden"
        >
          <Smile className="h-5 w-5" />
        </Button>

        {/* Message input */}
        <Textarea
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
          disabled={disabled}
        />

        {/* Send button */}
        <Button
          onClick={handleSubmit}
          disabled={!message.trim() || disabled || uploading}
          size="icon"
          className="flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {/* Media picker sheet for mobile */}
      <MediaPickerSheet
        open={showMediaPicker}
        onOpenChange={setShowMediaPicker}
        onEmojiSelect={handleEmojiSelect}
        onGifSelect={handleGifSelect}
        onStickerSelect={handleStickerSelect}
      />
    </div>
  );
}
