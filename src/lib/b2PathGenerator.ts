/**
 * Generates consistent file paths for Backblaze B2 storage
 * 
 * Path Structure: {ParentCategory}--{SubCategory}/{SubjectName}/{ChapterName}/{EntityType}_{EntityName}_{timestamp}.{ext}
 * Example: "Board_Exams--10th_SSLC/Physics/Mechanics/chapter_Mechanics_Notes_1234567890.pdf"
 */

export interface B2PathParams {
  parentCategoryName: string;
  subCategoryName: string;
  subjectName: string;
  chapterName?: string;
  entityType: 'chapter' | 'topic' | 'subtopic' | 'previous_year_paper';
  entityName: string;
  fileName: string;
}

/**
 * Sanitizes a string to be URL and filename safe
 */
function sanitizeForPath(str: string): string {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '') // Remove special chars except space, hyphen, underscore
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Generates a B2-compatible file path based on entity hierarchy
 */
export function generateB2Path(params: B2PathParams): string {
  const {
    parentCategoryName,
    subCategoryName,
    subjectName,
    chapterName,
    entityType,
    entityName,
    fileName
  } = params;

  // Sanitize all components
  const sanitizedParent = sanitizeForPath(parentCategoryName);
  const sanitizedSub = sanitizeForPath(subCategoryName);
  const sanitizedSubject = sanitizeForPath(subjectName);
  const sanitizedChapter = chapterName ? sanitizeForPath(chapterName) : 'General';
  const sanitizedEntity = sanitizeForPath(entityName);

  // Get file extension
  const fileExt = fileName.split('.').pop() || 'pdf';
  
  // Generate timestamp for uniqueness
  const timestamp = Date.now();

  // Build base path: {Parent}--{Sub}/{Subject}/{Chapter}
  const categoryFolder = `${sanitizedParent}--${sanitizedSub}`;
  const fullFileName = `${entityType}_${sanitizedEntity}_${timestamp}.${fileExt}`;

  // Add an extra folder level based on entity type so chapter/topic/subtopic
  // files are organised separately under each chapter
  const levelFolder =
    entityType === 'chapter'
      ? ''
      : entityType === 'topic'
        ? 'Topics'
        : entityType === 'subtopic'
          ? 'Subtopics'
          : 'PreviousYearPapers';

  const basePath = `${categoryFolder}/${sanitizedSubject}/${sanitizedChapter}`;
  const folderPath = levelFolder ? `${basePath}/${levelFolder}` : basePath;
  
  return `${folderPath}/${fullFileName}`;
}

/**
 * Parses a B2 path back into its components
 */
export function parseB2Path(path: string): {
  parentCategory: string;
  subCategory: string;
  subject: string;
  chapter: string;
  fileName: string;
} | null {
  const parts = path.split('/');
  
  if (parts.length < 4) {
    return null;
  }

  // Always treat the first three segments as:
  //   0: Parent--Sub
  //   1: Subject
  //   2: Chapter
  // Remaining segments (including any sub-folders) are joined back as fileName
  const [categoryPart, subject, chapter, ...rest] = parts;
  const [parentCategory, subCategory] = categoryPart.split('--');
  const fileName = rest.join('/') || '';

  return {
    parentCategory: parentCategory || '',
    subCategory: subCategory || '',
    subject,
    chapter,
    fileName
  };
}

/**
 * Gets the folder path (without filename) from a full path
 */
export function getFolderPath(fullPath: string): string {
  const parts = fullPath.split('/');
  parts.pop(); // Remove filename
  return parts.join('/');
}
