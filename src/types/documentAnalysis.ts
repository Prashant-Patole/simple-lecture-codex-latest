// Types for the Intelligent Self-Adaptive Question Extraction System

export interface QuestionTypeInfo {
  type: "mcq" | "integer" | "fill_blank" | "match" | "true_false" | "written" | "assertion_reason";
  count: number;
  questionRange?: string;
  sectionName?: string;
}

export interface DocumentSection {
  name: string;
  purpose: "questions" | "answers" | "instructions" | "other";
  approximatePosition: "beginning" | "middle" | "end";
}

export interface FormatPatterns {
  questionNumberFormat: string;
  optionFormat?: string;
  hasMathNotation: boolean;
  hasImages: boolean;
}

export interface ExtractionStrategy {
  recommendedApproach: "single_pass" | "section_by_section" | "type_by_type";
  suggestedChunkCount: number;
  specialInstructions: string[];
}

// NEW: Detailed answer key information
export interface AnswerKeyDetails {
  format: "table" | "inline_with_question" | "numbered_list" | "key_value_pairs" | "not_found";
  answerPatterns: string[];
  sampleAnswers?: { question: number; answer: string }[];
}

// NEW: Section numbering information for multi-section documents
export interface SectionInfo {
  name: string;
  type: "mcq" | "written" | "mixed";
  questionRange: string;
  absoluteRange: string;
}

export interface SectionNumbering {
  hasMultipleSections: boolean;
  sectionsRestartNumbering: boolean;
  sections: SectionInfo[];
  recommendedIdPrefix: boolean;
}

export interface DocumentAnalysis {
  totalEstimatedQuestions: number;
  hasAnswerKey: boolean;
  answerKeyLocation: "beginning" | "end" | "inline" | "separate_section" | "not_found";
  questionTypes: QuestionTypeInfo[];
  formatPatterns: FormatPatterns;
  documentSections: DocumentSection[];
  extractionStrategy: ExtractionStrategy;
  // NEW: Enhanced analysis fields
  answerKeyDetails?: AnswerKeyDetails;
  sectionNumbering?: SectionNumbering;
}

// Human-friendly labels for question types
export const questionTypeLabels: Record<QuestionTypeInfo["type"], string> = {
  mcq: "Multiple Choice (MCQ)",
  integer: "Integer/Numerical",
  fill_blank: "Fill in the Blank",
  match: "Match the Following",
  true_false: "True/False",
  written: "Written/Subjective",
  assertion_reason: "Assertion-Reason",
};

// Human-friendly labels for answer key locations
export const answerKeyLocationLabels: Record<DocumentAnalysis["answerKeyLocation"], string> = {
  beginning: "At the beginning",
  end: "At the end",
  inline: "Inline with questions",
  separate_section: "Separate section",
  not_found: "Not found",
};

// Human-friendly labels for extraction approaches
export const extractionApproachLabels: Record<ExtractionStrategy["recommendedApproach"], string> = {
  single_pass: "Single Pass (Fast)",
  section_by_section: "Section by Section",
  type_by_type: "Type by Type (Thorough)",
};

// Human-friendly labels for answer key formats
export const answerKeyFormatLabels: Record<AnswerKeyDetails["format"], string> = {
  table: "Table Format",
  inline_with_question: "Inline with Questions",
  numbered_list: "Numbered List",
  key_value_pairs: "Key-Value Pairs",
  not_found: "Not Found",
};
