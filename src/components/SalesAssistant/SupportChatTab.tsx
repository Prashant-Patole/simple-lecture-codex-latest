import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from '@/lib/supabaseUrl';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SupportFeedbackButtons } from "@/components/support/SupportFeedbackButtons";
import ReactMarkdown from "react-markdown";

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  category: string;
}

interface SupportMessage {
  id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

interface SupportChatTabProps {
  onUnreadCountChange?: (count: number) => void;
  openTicketId?: string | null;
}

export const SupportChatTab = ({ onUnreadCountChange, openTicketId }: SupportChatTabProps) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Fetch user's tickets
  useEffect(() => {
    fetchTickets();
  }, []);

  // Auto-open a ticket when requested by parent (e.g. just-created ticket)
  useEffect(() => {
    if (!openTicketId) return;
    const t = tickets.find((x) => x.id === openTicketId);
    if (t && selectedTicket?.id !== openTicketId) {
      setSelectedTicket(t);
      setShowFeedback(false);
      fetchMessages(openTicketId);
    }
  }, [openTicketId, tickets]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, status, created_at, category")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);

      // Count unread (admin_responded) tickets
      const unreadCount = (data || []).filter(t => t.status === "admin_responded").length;
      onUnreadCountChange?.(unreadCount);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, sender_type, content, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Check if last message is from AI to show feedback
      if (data && data.length > 0) {
        const lastMsg = data[data.length - 1];
        if (lastMsg.sender_type === "assistant") {
          setShowFeedback(true);
        }
      }

      // Mark ticket as read if it was admin_responded
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket?.status === "admin_responded") {
        await supabase
          .from("support_tickets")
          .update({ status: "open" })
          .eq("id", ticketId);
        fetchTickets(); // Refresh to update badge
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleTicketClick = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowFeedback(false);
    fetchMessages(ticket.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    setSending(true);
    setShowFeedback(false);
    const userContent = newMessage.trim();

    // Add user message to local state immediately
    const userMsg: SupportMessage = {
      id: `temp-user-${Date.now()}`,
      sender_type: "user",
      content: userContent,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setNewMessage("");

    try {
      // Save user message to database
      await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_type: "user",
        content: userContent,
      });

      // Update ticket status to open
      await supabase
        .from("support_tickets")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);

      // Call AI assistant with streaming
      setAiResponding(true);
      let assistantContent = "";
      const assistantId = `temp-ai-${Date.now()}`;

      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/ai-support-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94d2hxdnNvZWxxcXNibG1xa3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTU4NTgsImV4cCI6MjA3NTA5MTg1OH0.nZbWSb7AQK5uGAQmc7zXAceTHm9GRQJvqkg4-LNo_DM`,
          },
          body: JSON.stringify({
            messages: [...messages, userMsg].map(m => ({
              role: m.sender_type === "user" ? "user" : "assistant",
              content: m.content
            })),
            ticketId: selectedTicket.id,
          }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
          throw new Error("Rate limited");
        }
        if (resp.status === 402) {
          toast.error("Service temporarily unavailable.");
          throw new Error("Payment required");
        }
        throw new Error("AI request failed");
      }

      if (!resp.body) throw new Error("No response body");

      // Stream and parse SSE response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              // Update messages with streaming content
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, {
                  id: assistantId,
                  sender_type: "ai",
                  content: assistantContent,
                  created_at: new Date().toISOString(),
                }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Save AI response to database
      if (assistantContent) {
        await supabase.from("support_messages").insert({
          ticket_id: selectedTicket.id,
          sender_type: "ai",
          content: assistantContent,
        });

        await supabase
          .from("support_tickets")
          .update({ status: "ai_responded", updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id);
      }

      setShowFeedback(true);
    } catch (error) {
      console.error("AI error:", error);
      if (!(error instanceof Error && (error.message === "Rate limited" || error.message === "Payment required"))) {
        toast.error("Failed to get AI response");
      }
    } finally {
      setAiResponding(false);
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedTicket) return;

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status: "closed_resolved",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedTicket.id);

    if (error) {
      toast.error("Failed to resolve ticket");
      return;
    }

    toast.success("Ticket resolved! Thank you for your feedback.");
    setShowFeedback(false);
    setSelectedTicket({ ...selectedTicket, status: "closed_resolved" });
    fetchTickets();
  };

  const handleEscalate = async () => {
    if (!selectedTicket) return;

    const { error } = await supabase
      .from("support_tickets")
      .update({
        status: "escalated_to_admin",
        escalated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedTicket.id);

    if (error) {
      toast.error("Failed to escalate ticket");
      return;
    }

    toast.success("Ticket escalated to our support team. They will respond shortly.");
    setShowFeedback(false);
    setSelectedTicket({ ...selectedTicket, status: "escalated_to_admin" });
    fetchTickets();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "admin_responded":
        return <Badge variant="destructive" className="text-xs">Admin Replied</Badge>;
      case "escalated_to_admin":
        return <Badge variant="secondary" className="text-xs">Escalated</Badge>;
      case "closed_resolved":
        return <Badge variant="outline" className="text-xs">Closed</Badge>;
      case "ai_responded":
        return <Badge className="text-xs bg-primary">AI Responded</Badge>;
      default:
        return <Badge variant="default" className="text-xs">Open</Badge>;
    }
  };

  const getRoleBadge = (senderType: string) => {
    switch (senderType) {
      case "admin":
        return <span className="text-xs font-medium text-primary">Admin</span>;
      case "assistant":
        return <span className="text-xs font-medium text-primary">AI Assistant</span>;
      default:
        return <span className="text-xs font-medium text-foreground">You</span>;
    }
  };

  // Conversation view
  if (selectedTicket) {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-2 overflow-hidden">
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTicket(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">{selectedTicket.subject}</h4>
            {getStatusBadge(selectedTicket.status)}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md mb-2 overscroll-contain touch-pan-y">
          <div className="p-2 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 rounded-lg text-sm ${
                  msg.sender_type === "user"
                    ? "bg-primary/10 ml-4"
                    : msg.sender_type === "admin"
                    ? "bg-destructive/10 mr-4"
                    : "bg-muted mr-4"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  {getRoleBadge(msg.sender_type)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.sender_type === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            ))}

            {aiResponding && (
              <div className="p-2 rounded-lg text-sm bg-muted mr-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">AI is thinking...</span>
                </div>
              </div>
            )}

            {/* Feedback buttons - inside chat area */}
            {showFeedback && !aiResponding && selectedTicket.status !== "closed_resolved" && selectedTicket.status !== "escalated_to_admin" && (
              <div className="mr-4 mt-2">
                <SupportFeedbackButtons onResolve={handleResolve} onEscalate={handleEscalate} compact />
              </div>
            )}

            {messages.length === 0 && !aiResponding && (
              <p className="text-center text-muted-foreground text-sm py-4">No messages yet</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[44px] text-sm resize-none"
            disabled={aiResponding}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending || aiResponding}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Ticket list view
  return (
    <div className="p-2 flex-1 min-h-0 flex flex-col overflow-hidden">
      <h4 className="text-sm font-medium mb-2 flex-shrink-0">Your Support Tickets</h4>
      
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No support tickets yet</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleTicketClick(ticket)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                  ticket.status === "admin_responded" ? "border-destructive/50 bg-destructive/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{ticket.category}</p>
                  </div>
                  {getStatusBadge(ticket.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
