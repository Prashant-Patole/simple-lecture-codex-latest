import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Minus,
  ExternalLink,
  LayoutGrid,
} from 'lucide-react';
import {
  useSectionAvatarProgress,
  useProgressStats,
  AvatarLanguageInfo,
} from '@/hooks/useSectionAvatarProgress';
import { SUPPORTED_LANGUAGES } from '@/hooks/useLanguageAvatarJobs';

interface SectionAvatarProgressGridProps {
  externalJobId: string;
  serverIp?: string;
  selectedLanguages: string[];
  isGenerating: boolean;
}

// Pre-build language lookup Map once - O(1) lookups
const LANGUAGE_MAP: Map<string, typeof SUPPORTED_LANGUAGES[number]> = new Map(SUPPORTED_LANGUAGES.map(l => [l.code, l]));

export function SectionAvatarProgressGrid({
  externalJobId,
  serverIp,
  selectedLanguages,
  isGenerating,
}: SectionAvatarProgressGridProps) {
  const { sections, avatarStatusMap, allLanguagesInData, isLoading } = useSectionAvatarProgress(
    externalJobId,
    serverIp,
    isGenerating
  );

  // Merge selected languages with languages found in data - O(n)
  const displayedLanguages = useMemo(() => {
    const set = new Set([...selectedLanguages, ...allLanguagesInData]);
    return Array.from(set);
  }, [selectedLanguages, allLanguagesInData]);

  const progressStats = useProgressStats(sections, displayedLanguages, avatarStatusMap);

  // O(1) lookup for language display
  const getLanguageDisplay = (code: string) => {
    const lang = LANGUAGE_MAP.get(code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };

  // O(1) lookup for cell status
  const getCellStatus = (sectionId: number, language: string): AvatarLanguageInfo | undefined => {
    return avatarStatusMap.get(`${sectionId}_${language}`);
  };

  // Build view URL for completed avatars
  const getViewUrl = (sectionId: number, language: string): string | null => {
    const avatar = getCellStatus(sectionId, language);
    if (!avatar?.video_path || avatar.status !== 'completed') return null;

    const ip = serverIp || '69.197.145.4';
    return `http://${ip}:5005/player/jobs/${externalJobId}/${avatar.video_path}`;
  };

  // Check if any section in a row has completed avatars
  const hasAnyCompleted = (sectionId: number): boolean => {
    for (const lang of displayedLanguages) {
      const avatar = getCellStatus(sectionId, lang);
      if (avatar?.status === 'completed') return true;
    }
    return false;
  };

  // Get section-level status from avatar_languages data
  const getSectionStatus = (sectionId: number): 'processing' | 'completed' | 'queued' | 'pending' => {
    const hasAnyData = displayedLanguages.some(lang => getCellStatus(sectionId, lang));
    const hasProcessing = displayedLanguages.some(lang =>
      getCellStatus(sectionId, lang)?.status === 'processing'
    );
    if (hasProcessing) return 'processing';

    const allCompleted = displayedLanguages.length > 0 && displayedLanguages.every(lang =>
      getCellStatus(sectionId, lang)?.status === 'completed'
    );
    if (allCompleted) return 'completed';

    if (isGenerating && !hasAnyData) {
      // First section without data = currently processing on the server
      const firstPendingSection = sections.find(s =>
        !displayedLanguages.some(lang => getCellStatus(s.section_id, lang))
      );
      if (firstPendingSection && firstPendingSection.section_id === sectionId) {
        return 'processing';
      }
      return 'queued';
    }

    // Has partial data but not all completed while generating
    if (isGenerating && hasAnyData) return 'processing';

    return 'pending';
  };

  // Render status cell - only show spinner when this specific cell is processing
  const renderStatusCell = (sectionId: number, language: string) => {
    const avatar = getCellStatus(sectionId, language);

    if (avatar?.status === 'completed') {
      return (
        <div className="flex justify-center">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
      );
    }

    if (avatar?.status === 'processing') {
      return (
        <div className="flex justify-center">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <Minus className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  };

  // Render section status badge
  const renderSectionStatus = (sectionId: number) => {
    const status = getSectionStatus(sectionId);
    switch (status) {
      case 'processing':
        return (
          <div className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            <span className="text-xs font-medium text-primary">Processing</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">Done</span>
          </div>
        );
      case 'queued':
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Queued</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        );
    }
  };

  if (isLoading || sections.length === 0) {
    return null;
  }

  // Calculate overall progress
  const overallCompleted = Array.from(progressStats.values()).reduce(
    (sum, stat) => sum + stat.completed,
    0
  );
  const overallTotal = Array.from(progressStats.values()).reduce(
    (sum, stat) => sum + stat.total,
    0
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          Section Progress
          {isGenerating && (
            <Loader2 className="h-3 w-3 animate-spin text-primary ml-2" />
          )}
          <Badge variant="secondary" className="ml-auto">
            {overallCompleted}/{overallTotal} completed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Section</TableHead>
                <TableHead className="min-w-[110px]">Status</TableHead>
                {displayedLanguages.map((lang) => (
                  <TableHead key={lang} className="text-center min-w-[100px]">
                    {getLanguageDisplay(lang)}
                  </TableHead>
                ))}
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <TableRow key={section.section_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {section.section_id}
                      </Badge>
                      <span className="text-sm truncate max-w-[120px]" title={section.title}>
                        {section.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {renderSectionStatus(section.section_id)}
                  </TableCell>
                  {displayedLanguages.map((lang) => (
                    <TableCell key={lang} className="text-center">
                      {renderStatusCell(section.section_id, lang)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    {hasAnyCompleted(section.section_id) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          // Find first completed language for this section
                          for (const lang of displayedLanguages) {
                            const url = getViewUrl(section.section_id, lang);
                            if (url) {
                              window.open(url, '_blank');
                              break;
                            }
                          }
                        }}
                        title="View completed avatar"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Progress Summary */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
          {displayedLanguages.map((lang) => {
            const stat = progressStats.get(lang);
            if (!stat) return null;
            return (
              <div key={lang} className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">{getLanguageDisplay(lang)}:</span>
                <span className={stat.completed === stat.total ? 'text-emerald-600' : 'text-muted-foreground'}>
                  {stat.completed}/{stat.total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 text-primary" />
            <span>Processing</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3" />
            <span>Pending</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
