import { useState } from 'react';
import { GroupMessage } from '@/hooks/useGroupChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Reply, Trash2, MoreVertical, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: GroupMessage;
  isSelf: boolean;
  onReply: () => void;
  onDelete?: () => void;
}

export function MessageBubble({ message, isSelf, onReply, onDelete }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);

  // System message
  if (message.message_type === 'system') {
    return (
      <div className="flex items-center justify-center my-2">
        <span className="bg-muted/50 px-3 py-1 rounded-full text-xs text-muted-foreground italic">
          {message.content}
        </span>
      </div>
    );
  }

  const senderName = message.sender?.full_name || 'Unknown User';
  const initials = senderName.slice(0, 2).toUpperCase();
  const time = format(new Date(message.created_at), 'h:mm a');

  return (
    <div
      className={cn(
        'flex gap-2 group max-w-[85%]',
        isSelf ? 'ml-auto flex-row-reverse' : ''
      )}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {!isSelf && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col', isSelf ? 'items-end' : 'items-start')}>
        {!isSelf && (
          <span className="text-xs text-muted-foreground mb-1 px-1">
            {senderName}
          </span>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <div 
            className={cn(
              'text-xs px-3 py-1 rounded-t-lg border-l-2 mb-0.5',
              isSelf 
                ? 'bg-primary/20 border-primary/50 text-right' 
                : 'bg-muted border-muted-foreground/30'
            )}
          >
            <span className="font-medium">
              {message.reply_to.sender?.full_name || 'Unknown'}
            </span>
            <p className="truncate opacity-75 max-w-[200px]">
              {message.reply_to.content}
            </p>
          </div>
        )}

        {/* GIF message - no bubble background */}
        {message.message_type === 'gif' && message.file_url && (
          <div className="bg-transparent p-0">
            <img
              src={message.file_url}
              alt="GIF"
              className="rounded-lg max-w-[250px] max-h-[250px] object-cover"
            />
            <span 
              className={cn(
                'text-[10px] mt-1 block',
                isSelf ? 'text-muted-foreground' : 'text-muted-foreground'
              )}
            >
              {time}
            </span>
          </div>
        )}

        {/* Sticker/Emoji message - larger display, no bubble */}
        {message.message_type === 'sticker' && (
          <div className="bg-transparent p-0">
            <span className="text-5xl block">{message.content}</span>
            <span className="text-[10px] mt-1 block text-muted-foreground">
              {time}
            </span>
          </div>
        )}

        {/* Regular messages with bubble */}
        {message.message_type !== 'gif' && message.message_type !== 'sticker' && (
          <div
            className={cn(
              'relative px-3 py-2 rounded-2xl',
              isSelf
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted rounded-bl-sm',
              message.reply_to && 'rounded-t-sm'
            )}
          >
            {/* Image message */}
            {message.message_type === 'image' && message.file_url && (
              <div className="mb-2">
                <img
                  src={message.file_url}
                  alt="Shared image"
                  className="rounded-lg max-w-[250px] max-h-[300px] object-cover"
                />
              </div>
            )}

            {/* File message */}
            {message.message_type === 'file' && message.file_url && (
              <a
                href={message.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm underline"
              >
                <FileText className="h-4 w-4" />
                Attachment
              </a>
            )}

            {/* Text content */}
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}

            <span 
              className={cn(
                'text-[10px] mt-1 block',
                isSelf ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {time}
            </span>
          </div>
        )}
      </div>

      {/* Actions menu */}
      <div className={cn(
        'self-center transition-opacity',
        showMenu ? 'opacity-100' : 'opacity-0'
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isSelf ? 'end' : 'start'}>
            <DropdownMenuItem onClick={onReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
