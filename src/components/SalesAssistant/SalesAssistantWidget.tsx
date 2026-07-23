import { useState, useEffect, forwardRef } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SupportChatTab } from "./SupportChatTab";
import { useIsMobile } from "@/hooks/use-mobile";

export const SalesAssistantWidget = forwardRef<HTMLDivElement>((_, _ref) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [, setUnreadSupportCount] = useState(0);
  const isMobile = useIsMobile();

  // Lock background scroll when widget is open
  useEffect(() => {
    const html = document.documentElement;
    if (!isOpen) {
      html.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      return;
    }
    const scrollY = window.scrollY;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return () => {
      html.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (location.pathname.startsWith("/learning")) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${isMobile ? "bottom-28 h-10 w-10" : "bottom-6 h-14 w-14"} right-6 rounded-full shadow-lg z-50`}
        size="icon"
      >
        {isOpen ? <X className={isMobile ? "h-4 w-4" : "h-6 w-6"} /> : <MessageCircle className={isMobile ? "h-4 w-4" : "h-6 w-6"} />}
      </Button>

      {/* Chat Widget */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
          <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(24rem,calc(100vw-2rem))] h-[min(600px,calc(100dvh-4rem))] shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold">SimpleLecture Support</h3>
                <p className="text-xs opacity-90">Your support conversations.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <SupportChatTab onUnreadCountChange={setUnreadSupportCount} />
            </div>
          </Card>
        </>
      )}
    </>
  );
});

SalesAssistantWidget.displayName = "SalesAssistantWidget";
