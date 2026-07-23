// Course IDs that use the testing V4 player instead of the default
// EducationalVideoPlayerDialog for AI lectures.
export const V4_COURSE_IDS = new Set<string>([
  'e74e8e53-5949-4113-a565-1e84c2b4ee0e', // D.Pharmacy (testing)
]);

export const shouldUseV4Player = (courseId?: string | null): boolean =>
  !!courseId && V4_COURSE_IDS.has(courseId);
