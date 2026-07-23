import { PresentationSection } from '../types';
import { cn } from '@/lib/utils';

interface RecapSectionProps {
  section: PresentationSection;
  revealedIndices: number[];
  isVideoLayerVisible: boolean;
  jobId: string;
  serverIp: string;
  cdnBaseUrl?: string | null;
  isMobile?: boolean;
}

export const RecapSection = ({
  section,
  isMobile = false,
}: RecapSectionProps) => {
  return (
    <div className={cn("h-full", isMobile ? "p-1 pt-0" : "p-6")} />
  );
};
