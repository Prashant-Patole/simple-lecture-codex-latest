// Main exports for the Educational Video Player
export { EducationalVideoPlayer } from './EducationalVideoPlayer';
export { EducationalVideoPlayerDialog } from './EducationalVideoPlayerDialog';
export { PlayerControls } from './PlayerControls';
export { SectionPicker } from './SectionPicker';
export { LanguagePicker } from './LanguagePicker';
export { ContentRenderer } from './ContentRenderer';

// Types
export type { 
  PresentationData, 
  PresentationSection, 
  VisualBeat, 
  NarrationSegment,
  FlashCard,
  PlayerState,
} from './types';

// Utilities
export { 
  getAdminMediaUrl, 
  getStudentMediaUrl, 
  getAudioPath, 
  getAvatarVideoPath,
  getImagePath,
  extractJobIdFromUrl,
  extractVimeoId,
  getVimeoProxyUrl,
} from './utils/mediaResolver';

export { 
  buildSegmentTimingMap, 
  findCurrentSegment, 
  getRevealedBeatIndices,
  getTotalDuration,
  formatTime,
} from './utils/timingUtils';

// Hooks
export { usePlayerState } from './hooks/usePlayerState';
