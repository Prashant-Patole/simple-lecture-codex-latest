import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConflictInfo {
  type: "hard" | "soft"; // hard = overlapping, soft = back-to-back
  conflictType?: "instructor" | "subject" | "live_class"; // type of conflict
  existingEntry: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject_name?: string;
    course_name?: string;
    room_number?: string;
    instructor_name?: string;
  };
  newEntry: {
    day_of_week: number;
    start_time: string;
    end_time: string;
  };
  message: string;
}

interface TimetableEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  instructor_id?: string;
  subject_id?: string;
}

// Helper to convert time string to minutes for comparison
const timeToMinutes = (time: string): number => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

// Check if two time ranges overlap
export const doTimesOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

// Check if times are back-to-back (within 5 minutes)
const areTimesBackToBack = (
  end1: string,
  start2: string
): boolean => {
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  return Math.abs(s2 - e1) <= 5;
};

export const useInstructorConflicts = (instructorId?: string) => {
  return useQuery({
    queryKey: ["instructor-conflicts", instructorId],
    queryFn: async () => {
      if (!instructorId) return [];

      const { data, error } = await supabase
        .from("course_timetables")
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          room_number,
          course:courses(id, name),
          subject:popular_subjects(id, name)
        `)
        .eq("instructor_id", instructorId)
        .eq("is_active", true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!instructorId,
  });
};

// Check for subject conflicts - same subject at same time on same day
export const checkSubjectConflicts = async (
  newEntry: TimetableEntry,
  excludeEntryId?: string
): Promise<ConflictInfo[]> => {
  const conflicts: ConflictInfo[] = [];

  if (!newEntry.subject_id) return conflicts;

  // Fetch all timetable entries for this subject - use simple select to avoid TS depth issue
  const { data: subjectEntries, error } = await supabase
    .from("course_timetables")
    .select("id, day_of_week, start_time, end_time, room_number, instructor_id, subject_id")
    .eq("subject_id", newEntry.subject_id)
    .eq("is_active", true);

  if (error || !subjectEntries) return conflicts;

  // Get subject name separately
  const { data: subjectData } = await supabase
    .from("popular_subjects")
    .select("name")
    .eq("id", newEntry.subject_id)
    .single();

  const subjectName = subjectData?.name || "Subject";

  for (const existing of subjectEntries) {
    // Skip if same entry (for edit scenarios)
    if (excludeEntryId && existing.id === excludeEntryId) continue;
    
    // Skip if different day
    if (existing.day_of_week !== newEntry.day_of_week) continue;

    // Skip if same instructor (already handled by instructor conflict check)
    if (existing.instructor_id === newEntry.instructor_id) continue;

    // Check for overlapping times
    if (doTimesOverlap(
      newEntry.start_time,
      newEntry.end_time,
      existing.start_time,
      existing.end_time
    )) {
      conflicts.push({
        type: "hard",
        conflictType: "subject",
        existingEntry: {
          id: existing.id,
          day_of_week: existing.day_of_week,
          start_time: existing.start_time,
          end_time: existing.end_time,
          subject_name: subjectName,
          room_number: existing.room_number || undefined,
        },
        newEntry: {
          day_of_week: newEntry.day_of_week,
          start_time: newEntry.start_time,
          end_time: newEntry.end_time,
        },
        message: `Subject conflict: "${subjectName}" is already scheduled at this time by another instructor`,
      });
    }
  }

  return conflicts;
};

// Check for live class conflicts - instructor has a live class at this time
// Note: This is a placeholder that returns empty conflicts. 
// To enable live class conflict detection, create an RPC function or use a simpler query approach.
export const checkLiveClassConflicts = async (
  _instructorId: string,
  _dayOfWeek: number,
  _startTime: string,
  _endTime: string
): Promise<ConflictInfo[]> => {
  // Live class conflict detection is disabled due to TypeScript type depth issues with the scheduled_classes table.
  // The main conflict detection (instructor time conflicts and subject conflicts) still works.
  return [];
};

// Function to check conflicts for a new entry against existing entries
export const checkConflicts = (
  newEntry: TimetableEntry,
  existingEntries: any[],
  excludeEntryId?: string
): ConflictInfo[] => {
  const conflicts: ConflictInfo[] = [];

  for (const existing of existingEntries) {
    // Skip if same entry (for edit scenarios)
    if (excludeEntryId && existing.id === excludeEntryId) continue;
    
    // Skip if different day
    if (existing.day_of_week !== newEntry.day_of_week) continue;

    // Check for hard conflict (overlapping times)
    if (doTimesOverlap(
      newEntry.start_time,
      newEntry.end_time,
      existing.start_time,
      existing.end_time
    )) {
      conflicts.push({
        type: "hard",
        existingEntry: {
          id: existing.id,
          day_of_week: existing.day_of_week,
          start_time: existing.start_time,
          end_time: existing.end_time,
          subject_name: existing.subject?.name,
          course_name: existing.course?.name,
          room_number: existing.room_number,
        },
        newEntry: {
          day_of_week: newEntry.day_of_week,
          start_time: newEntry.start_time,
          end_time: newEntry.end_time,
        },
        message: `Time conflict: Instructor already has ${existing.subject?.name || "a class"} from ${existing.start_time} to ${existing.end_time}`,
      });
    }
    // Check for soft conflict (back-to-back classes)
    else if (
      areTimesBackToBack(existing.end_time, newEntry.start_time) ||
      areTimesBackToBack(newEntry.end_time, existing.start_time)
    ) {
      conflicts.push({
        type: "soft",
        existingEntry: {
          id: existing.id,
          day_of_week: existing.day_of_week,
          start_time: existing.start_time,
          end_time: existing.end_time,
          subject_name: existing.subject?.name,
          course_name: existing.course?.name,
          room_number: existing.room_number,
        },
        newEntry: {
          day_of_week: newEntry.day_of_week,
          start_time: newEntry.start_time,
          end_time: newEntry.end_time,
        },
        message: `Warning: Back-to-back with ${existing.subject?.name || "another class"} (${existing.start_time}-${existing.end_time})`,
      });
    }
  }

  return conflicts;
};

// Hook to check conflicts for multiple entries at once
export const useCheckMultipleConflicts = () => {
  const checkMultiple = async (
    entries: TimetableEntry[],
    excludeIds: string[] = []
  ): Promise<Map<string, ConflictInfo[]>> => {
    const conflictMap = new Map<string, ConflictInfo[]>();
    
    // Group entries by instructor
    const entriesByInstructor = new Map<string, TimetableEntry[]>();
    for (const entry of entries) {
      if (!entry.instructor_id) continue;
      const existing = entriesByInstructor.get(entry.instructor_id) || [];
      entriesByInstructor.set(entry.instructor_id, [...existing, entry]);
    }

    // For each instructor, fetch their existing timetable and check conflicts
    for (const [instructorId, instructorEntries] of entriesByInstructor) {
      const { data: existingEntries } = await supabase
        .from("course_timetables")
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          room_number,
          course:courses(id, name),
          subject:popular_subjects(id, name)
        `)
        .eq("instructor_id", instructorId)
        .eq("is_active", true);

      for (const newEntry of instructorEntries) {
        const entryKey = `${newEntry.day_of_week}-${newEntry.start_time}-${newEntry.instructor_id}`;
        const conflicts = checkConflicts(
          newEntry,
          existingEntries || [],
          undefined
        );
        if (conflicts.length > 0) {
          conflictMap.set(entryKey, conflicts);
        }
      }
    }

    return conflictMap;
  };

  return { checkMultiple };
};
