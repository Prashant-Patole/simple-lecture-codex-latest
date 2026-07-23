// V3 Player types — standalone, no shared types with educational player

export type V4SectionType =
  | 'intro'
  | 'content'
  | 'summary'
  | 'memory'
  | 'memory_infographic'
  | 'recap'
  | 'quiz';

export interface V4Segment {
  text: string;
  duration_seconds?: number;
  duration?: number;
  start_seconds?: number;
  end_seconds?: number;
  purpose?: string;
  beat_videos?: string[];
  video_path?: string;
}

export interface V4Narration {
  full_text?: string;
  total_duration_seconds?: number;
  segments: V4Segment[];
}

export interface V4VisualBeat {
  beat_start_seconds: number;
  beat_end_seconds: number;
  visual_type: string; // 'video' | 'image' | 'infographic'
  video_path?: string;
  image_source?: string;
}

export interface V4InfographicBeat {
  start_seconds?: number;
  end_seconds?: number;
  image_source?: string;
}

export interface V4RenderSpec {
  infographic_beats?: V4InfographicBeat[];
}

export interface V4ExplanationVisual {
  video_path?: string;
  wan_video_path?: string;
  image_path?: string;
  image_source?: string;
}

export interface V4QuizNarration {
  option_reveal_seconds?: number[];
  question_script?: string;
  correct_script?: string;
  wrong_script?: string;
  explanation_script?: string;
}

export interface V4Question {
  question: string;
  question_text?: string;
  options: Record<string, string>;
  correct: string;
  correct_option?: string;
  explanation?: string;
  option_reveal_seconds?: number[];
  narration?: V4QuizNarration;
  avatar_clips?: {
    question?: string;
    correct?: string;
    wrong?: string;
    explanation?: string;
  };
  script?: {
    question?: string;
    correct?: string;
    wrong?: string;
    explanation?: string;
  };
  explanation_visual?: V4ExplanationVisual;
}

export interface V4Flashcard {
  q?: string;
  a?: string;
  front?: string;
  back?: string;
  question?: string;
  answer?: string;
}

export interface V4Section {
  section_id: string | number;
  title: string;
  section_type: V4SectionType;
  type?: string;
  renderer?: string;
  narration?: V4Narration;
  avatar_video?: string;
  avatar_url?: string;
  avatar?: string;
  b2_url?: string;
  avatar_languages?: Array<{
    language?: string;
    status?: string;
    video_path?: string;
    url?: string;
    path?: string;
    avatar_url?: string;
    b2_url?: string;
    video_url?: string;
  }>;
  video_path?: string;
  /** Pipeline-merged single video per section (avatar + visuals composited). When present, V4 plays this as the sole source. */
  final_video_path?: string;
  manim_video_paths?: string[];
  beat_video_paths?: string[];
  visual_beats?: V4VisualBeat[];
  render_spec?: V4RenderSpec;
  flashcards?: V4Flashcard[];
  understanding_quiz?: V4Question;
  questions?: V4Question[];
  segment_duration_seconds?: number;
  dur?: number;
  avatar_layer?: any;
}

export interface V4Presentation {
  presentation_title?: string;
  title?: string;
  avatar_name?: string;
  subject?: string;
  /** When present, V4 plays this single pre-composited video and skips all sections/overlays. */
  final_video_path?: string;
  /** Vimeo URL of the merged final video. Preferred over final_video_path when vimeo_uploaded is true. */
  vimeo_url?: string;
  vimeo_mp4_url?: string;
  vimeo_uploaded?: boolean;
  /** Per-language merged video fields (naming convention: `<lang>_final_video`, `<lang>_vimeo_mp4_url`). */
  kannada_final_video?: string;
  kannada_vimeo_url?: string;
  kannada_vimeo_mp4_url?: string;
  sections: V4Section[];
  [key: string]: any;
}


export type SubtitleMode = 'karaoke' | 'full' | 'off';
