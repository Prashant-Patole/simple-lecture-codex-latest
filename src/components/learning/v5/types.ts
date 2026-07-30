export type V5Language = 'english' | 'kannada';

export interface V5WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface V5SubtitleSection {
  words?: V5WordTiming[];
}

export interface V5SubtitleData {
  version?: number;
  sections?: Record<string, V5SubtitleSection>;
}

export interface V5NarrationSegment {
  text?: string;
  duration_seconds?: number;
  duration?: number;
}

export interface V5Section {
  section_id: string | number;
  section_type?: string;
  type?: string;
  title?: string;
  renderer?: string;
  key_points?: unknown;
  narration?: {
    total_duration_seconds?: number;
    segments?: V5NarrationSegment[];
  };
}

export interface V5Presentation {
  presentation_title?: string;
  title?: string;
  final_video_path?: string;
  final_video_url?: string;
  vimeo_mp4_url?: string;
  kannada_final_video?: string;
  kannada_vimeo_mp4_url?: string;
  sections: V5Section[];
}

export interface V5TimelineSection {
  section: V5Section;
  sectionIndex: number;
  start: number;
  end: number;
  duration: number;
  keyPoints: string[];
}
