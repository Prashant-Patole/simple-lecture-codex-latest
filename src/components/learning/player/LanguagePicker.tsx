import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from '@/components/ui/select';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES } from '@/hooks/useLanguageAvatarJobs';

interface LanguagePickerProps {
  availableLanguages: string[];  // ['hindi', 'kannada']
  currentLanguage: string | null;  // null = English/default
  onLanguageChange: (lang: string | null) => void;
  container?: HTMLElement | null;  // For fullscreen portal
  className?: string;
}

// Get language display info
const getLanguageDisplay = (code: string) => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang || { code, name: code.charAt(0).toUpperCase() + code.slice(1), flag: '🌐' };
};

export const LanguagePicker = ({
  availableLanguages,
  currentLanguage,
  onLanguageChange,
  container,
  className,
}: LanguagePickerProps) => {
  // Don't render if no additional languages available
  if (availableLanguages.length === 0) {
    return null;
  }

  const currentDisplay = currentLanguage 
    ? getLanguageDisplay(currentLanguage)
    : { code: 'english', name: 'English', flag: '🇬🇧' };

  return (
    <div className={cn("flex items-center", className)}>
      <Select
        value={currentLanguage || 'english'}
        onValueChange={(value) => onLanguageChange(value === 'english' ? null : value)}
      >
        <SelectTrigger className="language-picker-trigger w-auto min-w-[100px] bg-white/5 border-white/10 text-white hover:bg-white/10 gap-1.5">
          <Globe className="h-3.5 w-3.5 opacity-70" />
          <SelectValue>
            <span className="text-xs font-medium">
              {currentDisplay.flag} {currentDisplay.name}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectPrimitive.Portal container={container ?? undefined}>
          <SelectPrimitive.Content
            className="relative z-50 max-h-96 min-w-[160px] overflow-hidden rounded-md border bg-slate-900 border-slate-700 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            position="popper"
          >
            <SelectScrollUpButton />
            <SelectPrimitive.Viewport className="p-1">
              {/* English (Default) option */}
              <SelectItem 
                value="english"
                className="text-gray-200 focus:bg-white/10 focus:text-white"
              >
                <div className="flex items-center gap-2 w-full">
                  <span>🇬🇧</span>
                  <span className="flex-1">English</span>
                  <span className="text-xs text-gray-400">(Default)</span>
                  {!currentLanguage && <Check className="h-3 w-3 text-green-400" />}
                </div>
              </SelectItem>
              
              {/* Available language options */}
              {availableLanguages.map((langCode) => {
                const lang = getLanguageDisplay(langCode);
                const isSelected = currentLanguage === langCode;
                
                return (
                  <SelectItem 
                    key={langCode}
                    value={langCode}
                    className="text-gray-200 focus:bg-white/10 focus:text-white"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span>{lang.flag}</span>
                      <span className="flex-1">{lang.name}</span>
                      {isSelected && <Check className="h-3 w-3 text-green-400" />}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectPrimitive.Viewport>
            <SelectScrollDownButton />
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </Select>
    </div>
  );
};
