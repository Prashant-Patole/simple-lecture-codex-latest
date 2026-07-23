// Types mirroring the /ai-text-answer endpoint response.

export interface AITextAnswerSource {
  doc_title: string;
  section_title?: string;
}

export interface SlideAudioUrl {
  audioUrl: string;
  duration: number;
  slideIndex: number;
}

export interface PresentationSlide {
  title: string;
  bullet_points?: string[];
  keyPoints?: string[];
  duration?: number;
  infographicUrl?: string;
  manimVideoUrl?: string;
}

export interface SlidePreview {
  found: boolean;
  cache_id?: string;
  similarity?: number;
  matched_question?: string;
  presentation_slides?: PresentationSlide[];
  slide_audio_urls?: { urls?: SlideAudioUrl[] };
  image_urls?: Record<string, { url: string }>;
  total_duration_seconds?: number;
}

export interface AITextAnswerSuggestion {
  question: string;
  cache_id?: string;
  similarity?: number;
  has_slides?: boolean;
}

export interface AITextAnswerData {
  cached?: boolean;
  cache_layer?: string;
  cache_id?: string;
  answer: string;
  key_points?: string[];
  sources?: AITextAnswerSource[];
  is_doc_grounded?: boolean;
  exam_tip?: string;
  quick_tip?: string;
  real_life_example?: string;
  example?: string;
  slide_preview?: SlidePreview | null;
  suggestions?: AITextAnswerSuggestion[];
}

export type AITextAnswerResult =
  | { ok: true; data: AITextAnswerData }
  | { ok: false; reason: "no_content"; message?: string }
  | { ok: false; reason: "error"; message: string };
