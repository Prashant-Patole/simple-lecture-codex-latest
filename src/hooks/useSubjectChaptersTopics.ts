// Re-export from centralized hooks to ensure cache sharing
// This file is kept for backwards compatibility
export {
  useSubjectChapters,
  useChapterTopics,
  type SubjectChapter,
  type SubjectTopic,
} from "./useSubjectManagement";

// Export optimized hooks from the new module
export {
  useSubjectChaptersWithTopics,
  useBatchUpdateChapterOrder,
  useBatchUpdateTopicOrder,
  useBatchUpdateSubtopicOrder,
  useOptimizedBulkImport,
} from "./useSubjectChaptersOptimized";
