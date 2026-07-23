import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { User, Volume2, VolumeX } from 'lucide-react';
import { SupportedLanguage } from '@/hooks/useGoogleTTS';

interface FloatingAvatarProps {
  isSpeaking: boolean;
  isProcessing: boolean;
  language: SupportedLanguage;
  onMuteToggle?: () => void;
  isMuted?: boolean;
  position?: 'bottom-left' | 'top-right';
}

export function FloatingAvatar({ 
  isSpeaking, 
  isProcessing,
  language,
  onMuteToggle,
  isMuted = false,
  position = 'bottom-left'
}: FloatingAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const gender = language === 'hi-IN' ? 'female' : 'male';
        const { data } = await supabase
          .from('counselor_avatars')
          .select('image_url')
          .eq('gender', gender)
          .eq('is_active', true)
          .order('display_order')
          .limit(1)
          .maybeSingle();

        if (data) setAvatarUrl(data.image_url);
      } catch (error) {
        console.error('Error fetching avatar:', error);
      }
    };
    fetchAvatar();
  }, [language]);

  return (
    <div className={cn(
      "absolute z-30 flex gap-2",
      position === 'top-right' 
        ? "top-4 right-4 items-start flex-row-reverse" 
        : "bottom-4 left-4 items-end"
    )}>
      {/* Avatar - static, no animations */}
      <div 
        className="relative w-16 h-16 rounded-full overflow-hidden cursor-pointer border-2 border-primary shadow-md"
        onClick={onMuteToggle}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="Professor"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        
        {/* Mute indicator */}
        {isMuted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <VolumeX className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
