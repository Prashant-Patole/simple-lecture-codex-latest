import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Loader2 } from "lucide-react";
import { ConversationStageIndicator } from "./ConversationStageIndicator";
import { CounselorAvatar } from "./CounselorAvatar";
import { ConversationState, ConversationStage } from "@/hooks/useSalesAssistant";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationModeProps {
  messages: Message[];
  conversationState: ConversationState;
  conversationStage: ConversationStage;
  isLoading: boolean;
  onClose: () => void;
  onSendMessage: (content: string) => void;
  onStateChange: (state: ConversationState) => void;
}

export const ConversationMode = ({
  messages,
  conversationState,
  conversationStage,
  isLoading,
  onClose,
  onSendMessage,
  onStateChange,
}: ConversationModeProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [counselorGender] = useState<"female" | "male">("male");
  const counselorName = counselorGender === "female" ? "Priya" : "Rahul";
  const [textInput, setTextInput] = useState("");

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Update conversation state based on loading
  useEffect(() => {
    if (isLoading) {
      onStateChange("processing");
    } else {
      onStateChange("idle");
    }
  }, [isLoading, onStateChange]);

  const handleTextSend = () => {
    if (textInput.trim() && !isLoading) {
      onSendMessage(textInput.trim());
      setTextInput("");
      onStateChange("processing");
    }
  };

  return (
    <Card className="fixed inset-4 z-50 flex flex-col bg-background shadow-2xl">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">AI Assistant</h3>
          <p className="text-xs opacity-90">SimpleLecture Support</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Conversation Stage Indicator */}
      <ConversationStageIndicator currentStage={conversationStage} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Avatar area */}
        <div className="hidden md:flex w-1/3 items-center justify-center border-r bg-muted/30">
          <CounselorAvatar
            gender={counselorGender}
            conversationState={conversationState}
          />
        </div>

        {/* Right: Transcript */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b bg-muted/50">
            <h4 className="font-semibold text-sm text-muted-foreground">Conversation</h4>
          </div>
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-xs font-semibold mb-1 opacity-70">
                      {message.role === "user" ? "You" : counselorName}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg p-3 bg-muted text-foreground">
                    <p className="text-xs font-semibold mb-1 opacity-70">{counselorName}</p>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          {/* Text Input */}
          <div className="border-t p-3 flex gap-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTextSend();
              }}
              placeholder="Type your question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleTextSend}
              disabled={!textInput.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-3 bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {isLoading
              ? "⏳ Processing your message..."
              : "💡 Type your question below"}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            End Conversation
          </Button>
        </div>
      </div>
    </Card>
  );
};
