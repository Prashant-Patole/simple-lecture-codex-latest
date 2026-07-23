import { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  useGroupDetails, 
  useGroupMessages, 
  useGroupMembership,
  useSendMessage,
  useTypingIndicator,
  MessageType,
} from '@/hooks/useGroupChat';
import { GroupChatHeader } from '@/components/forum/GroupChatHeader';
import { MessageList } from '@/components/forum/MessageList';
import { MessageInput } from '@/components/forum/MessageInput';
import { GroupInfoSheet } from '@/components/forum/GroupInfoSheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Lock } from 'lucide-react';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Header } from '@/components/Header';

export default function ForumGroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [infoOpen, setInfoOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: group, isLoading: groupLoading } = useGroupDetails(groupId!);
  const { data: messages, isLoading: messagesLoading } = useGroupMessages(groupId!);
  const { data: membership, isLoading: membershipLoading } = useGroupMembership(groupId!);
  const sendMessage = useSendMessage();
  const { typingUsers, setTyping } = useTypingIndicator(groupId!);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (content: string, fileUrl?: string, messageType?: MessageType) => {
    if (!content.trim() && !fileUrl) return;

    await sendMessage.mutateAsync({
      groupId: groupId!,
      content: content.trim(),
      messageType: messageType || (fileUrl ? 'image' : 'text'),
      fileUrl,
      replyToId: replyTo?.id,
    });

    setReplyTo(null);
  };

  const handleTyping = () => {
    if (userProfile?.full_name) {
      setTyping(userProfile.full_name);
    }
  };

  if (groupLoading || membershipLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Group not found</p>
        <Button asChild>
          <Link to="/forum">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Forum
          </Link>
        </Button>
      </div>
    );
  }

  // Not a member - show access denied
  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <Card className="p-8 text-center max-w-md">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            {group.is_private 
              ? "This is a private group. Only invited members can access it."
              : "You need to join this group to view messages."
            }
          </p>
          <Button asChild>
            <Link to="/forum">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Forum
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const isAdmin = membership.role === 'admin';
  const isCreator = group.created_by === user?.id;

  return (
    <div className="flex flex-col h-screen bg-background">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      {/* Header */}
      <GroupChatHeader
        group={group}
        onBack={() => navigate('/forum')}
        onInfoClick={() => setInfoOpen(true)}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList
          messages={messages || []}
          currentUserId={user?.id || ''}
          isLoading={messagesLoading}
          onReply={(msg) => setReplyTo({
            id: msg.id,
            content: msg.content,
            senderName: msg.sender?.full_name || 'Unknown',
          })}
          isAdmin={isAdmin}
          groupId={groupId!}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-muted-foreground italic">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Message Input */}
      <MessageInput
        onSend={handleSendMessage}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        groupId={groupId!}
        disabled={sendMessage.isPending}
      />

      {/* Group Info Sheet */}
      <GroupInfoSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        groupId={groupId!}
        group={group}
        isAdmin={isAdmin}
        isCreator={isCreator}
        currentUserId={user?.id || ''}
      />
      <BottomNav />
    </div>
  );
}
