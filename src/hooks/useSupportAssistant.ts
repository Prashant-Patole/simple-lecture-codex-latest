import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/lib/supabaseUrl';
import { toast } from '@/hooks/use-toast';

export interface SupportMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
  closed_at: string | null;
}

export const useSupportAssistant = () => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);

  const createTicket = async (category: string, subject: string, initialMessage: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Please log in to create a support ticket", variant: "destructive" });
      return null;
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        category,
        subject,
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating ticket:", error);
      toast({ title: "Failed to create support ticket", variant: "destructive" });
      return null;
    }

    // Save the initial message
    await supabase.from('support_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'user',
      content: initialMessage
    });

    setCurrentTicketId(ticket.id);
    return ticket;
  };

  const sendMessage = useCallback(async (userMessage: string, ticketId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const userMsg: SupportMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Save user message to database
    if (ticketId || currentTicketId) {
      await supabase.from('support_messages').insert({
        ticket_id: ticketId || currentTicketId,
        sender_type: 'user',
        content: userMessage
      });
    }

    let assistantContent = "";
    const assistantId = `assistant-${Date.now()}`;

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantId) {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, { 
          id: assistantId, 
          role: 'assistant', 
          content: assistantContent, 
          createdAt: new Date() 
        }];
      });
    };

    try {
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/ai-support-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
            ticketId: ticketId || currentTicketId,
            userId: user?.id
          }),
        }
      );

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
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
            if (content) updateAssistant(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Save AI response to database
      if ((ticketId || currentTicketId) && assistantContent) {
        await supabase.from('support_messages').insert({
          ticket_id: ticketId || currentTicketId,
          sender_type: 'ai',
          content: assistantContent
        });

        // Update ticket status
        await supabase
          .from('support_tickets')
          .update({ status: 'ai_responded' })
          .eq('id', ticketId || currentTicketId);
      }

    } catch (error) {
      console.error("Stream error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get response",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentTicketId]);

  const resolveTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ 
        status: 'closed_resolved',
        closed_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) {
      toast({ title: "Failed to close ticket", variant: "destructive" });
      return false;
    }

    toast({ title: "Ticket resolved successfully!" });
    return true;
  };

  const escalateTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ 
        status: 'escalated_to_admin',
        escalated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) {
      toast({ title: "Failed to escalate ticket", variant: "destructive" });
      return false;
    }

    toast({ title: "Ticket escalated to support team. They will respond shortly." });
    return true;
  };

  const clearMessages = () => {
    setMessages([]);
    setCurrentTicketId(null);
  };

  return {
    messages,
    isLoading,
    currentTicketId,
    setCurrentTicketId,
    createTicket,
    sendMessage,
    resolveTicket,
    escalateTicket,
    clearMessages,
    setMessages
  };
};
