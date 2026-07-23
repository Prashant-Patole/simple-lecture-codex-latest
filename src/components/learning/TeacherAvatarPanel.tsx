import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Volume2, VolumeX, User, Brain, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SupportedLanguage } from '@/hooks/useGoogleTTS';

interface TeacherAvatarPanelProps {
  isSpeaking: boolean;
  isProcessing: boolean;
  language: SupportedLanguage;
  onMuteToggle?: () => void;
  isMuted?: boolean;
  subjectName?: string;
}

export function TeacherAvatarPanel({ 
  isSpeaking, 
  isProcessing,
  language,
  onMuteToggle,
  isMuted = false,
  subjectName
}: TeacherAvatarPanelProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState<string>('Professor');

  // Fetch teacher avatar from counselor_avatars
  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const gender = language === 'hi-IN' ? 'female' : 'male';
        
        const { data } = await supabase
          .from('counselor_avatars')
          .select('*')
          .eq('gender', gender)
          .eq('is_active', true)
          .order('display_order')
          .limit(1)
          .maybeSingle();

        if (data) {
          setAvatarUrl(data.image_url);
          setAvatarName(data.name);
        }
      } catch (error) {
        console.error('Error fetching avatar:', error);
      }
    };

    fetchAvatar();
  }, [language]);

  const professorTitle = subjectName 
    ? `${subjectName} AI Professor` 
    : language === 'hi-IN' ? 'AI प्रोफेसर' : 'AI Professor';

  // Status configuration
  const getStatusConfig = () => {
    if (isProcessing) {
      return {
        color: 'from-amber-400 to-orange-500',
        text: language === 'hi-IN' ? 'सोच रहा हूं...' : 'Thinking...',
        icon: Brain,
      };
    }
    if (isSpeaking) {
      return {
        color: 'from-emerald-400 to-green-500',
        text: language === 'hi-IN' ? 'बोल रहा हूं...' : 'Speaking...',
        icon: Volume2,
      };
    }
    return {
      color: 'from-primary to-secondary',
      text: language === 'hi-IN' ? 'तैयार' : 'Ready',
      icon: Sparkles,
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col items-center justify-center h-full glass-strong rounded-xl p-4 relative overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-secondary/15" />
      
      {/* Dotted/Grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50" />
      
      {/* Avatar Container */}
      <div className="relative z-10">
        {/* Avatar border ring */}
        <div className={cn(
          "relative w-24 h-24 rounded-full p-1 transition-all duration-300",
          `bg-gradient-to-r ${status.color}`
        )}>
          {/* Inner avatar container */}
          <div className="w-full h-full rounded-full overflow-hidden bg-background">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={avatarName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <User className="w-12 h-12 text-primary" />
              </div>
            )}
          </div>
        </div>
        
        {/* Status indicator dot */}
        <div className={cn(
          "absolute -bottom-1 right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center",
          `bg-gradient-to-r ${status.color}`
        )}>
          <StatusIcon className="h-2.5 w-2.5 text-white" />
        </div>
      </div>

      {/* Teacher Info */}
      <h3 className="mt-4 text-sm font-semibold text-foreground text-center">
        {avatarName}
      </h3>
      <p className="text-xs text-muted-foreground text-center mt-0.5">
        {professorTitle}
      </p>

      {/* Enhanced Audio Waveform */}
      <div className="mt-4 w-full max-w-[120px]">
        <div className="h-8 flex items-end justify-center gap-0.5">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div 
              key={i} 
              className={cn(
                "w-1 rounded-full transition-all duration-300",
                isSpeaking 
                  ? "bg-gradient-to-t from-emerald-500 to-green-400 waveform-bar-enhanced"
                  : "bg-muted-foreground/30 h-1"
              )}
              style={{
                animationDelay: isSpeaking ? `${i * 0.08}s` : '0s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Status Badge */}
      <div className={cn(
        "mt-3 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all duration-300",
        `bg-gradient-to-r ${status.color}`,
        "text-white shadow-lg"
      )}>
        <StatusIcon className="h-3 w-3" />
        {status.text}
      </div>

      {/* Mute Button */}
      {onMuteToggle && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "mt-3 h-8 w-8 p-0 rounded-full transition-all",
            isMuted && "bg-destructive/10 text-destructive"
          )}
          onClick={onMuteToggle}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
