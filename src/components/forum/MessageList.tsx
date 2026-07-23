import { GroupMessage, useDeleteMessage } from '@/hooks/useGroupChat';
import { MessageBubble } from './MessageBubble';
import { Loader2 } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

interface MessageListProps {
  messages: GroupMessage[];
  currentUserId: string;
  isLoading: boolean;
  onReply: (message: GroupMessage) => void;
  isAdmin: boolean;
  groupId: string;
}

export function MessageList({ 
  messages, 
  currentUserId, 
  isLoading, 
  onReply, 
  isAdmin,
  groupId,
}: MessageListProps) {
  const deleteMessage = useDeleteMessage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">No messages yet</p>
        <p className="text-sm">Be the first to send a message!</p>
      </div>
    );
  }

  const formatDateSeparator = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const handleDelete = (messageId: string) => {
    deleteMessage.mutate({ messageId, groupId });
  };

  let lastDate: Date | null = null;

  return (
    <div className="flex flex-col gap-1 p-4">
      {messages.map((message) => {
        const messageDate = new Date(message.created_at);
        const showDateSeparator = !lastDate || !isSameDay(lastDate, messageDate);
        lastDate = messageDate;

        const isSelf = message.sender_id === currentUserId;
        const canDelete = isSelf || isAdmin;

        return (
          <div key={message.id}>
            {showDateSeparator && (
              <div className="flex items-center justify-center my-4">
                <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                  {formatDateSeparator(messageDate)}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              isSelf={isSelf}
              onReply={() => onReply(message)}
              onDelete={canDelete ? () => handleDelete(message.id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
