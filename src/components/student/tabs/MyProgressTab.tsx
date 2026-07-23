import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressFilters } from "@/components/admin/students/tabs/ProgressFilters";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, BookOpen, Video, FileCheck, GraduationCap, ClipboardList, Loader2, ChevronDown, ChevronUp, Award, CalendarCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useProgressTrends } from "@/hooks/useProgressTrends";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MyProgressTabProps {
  student: any;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        <p className="text-primary font-medium mb-2">
          Overall: {data.progress}%
        </p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <BookOpen className="h-3 w-3" /> Chapters: {data.breakdown.chapters}%
          </p>
          <p className="flex items-center gap-2">
            <Video className="h-3 w-3" /> Videos: {data.breakdown.videos}%
          </p>
          <p className="flex items-center gap-2">
            <FileCheck className="h-3 w-3" /> MCQs: {data.breakdown.mcqs}%
          </p>
          <p className="flex items-center gap-2">
            <GraduationCap className="h-3 w-3" /> Exams: {data.breakdown.exams}%
          </p>
          <p className="flex items-center gap-2">
            <Award className="h-3 w-3" /> Proficiency: {data.breakdown.proficiencyTests}%
          </p>
          <p className="flex items-center gap-2">
            <ClipboardList className="h-3 w-3" /> Assignments: {data.breakdown.assignments}%
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const MyProgressTab = ({ student }: MyProgressTabProps) => {
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [showChapterDetails, setShowChapterDetails] = useState(false);

  const hasCourses = (student.courses?.length || 0) > 0;

  // Get course ID from name
  const courseIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    student.courses?.forEach((c: any) => {
      map[c.name] = c.id;
    });
    return map;
  }, [student.courses]);

  const courseId = selectedCourse !== "all" ? courseIdMap[selectedCourse] : undefined;

  // Get subjects filtered by selected course
  const subjects = useMemo(() => {
    const allSubjects = new Set<string>();
    student.courses?.forEach((course: any) => {
      if (selectedCourse !== "all" && course.name !== selectedCourse) return;
      course.subjects?.forEach((subject: string) => allSubjects.add(subject));
    });
    return Array.from(allSubjects);
  }, [student.courses, selectedCourse]);

  // Fetch real progress trends with subject name
  const { data: progressData, isLoading: isLoadingProgress } = useProgressTrends({
    courseId,
    subjectName: selectedSubject !== "all" ? selectedSubject : undefined,
    days: 30,
  });

  const courses = useMemo(() => 
    student.courses?.map((c: any) => c.name) || [],
    [student.courses]
  );

  // Empty state
  if (!hasCourses) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Progress Data Yet</h3>
            <p className="text-muted-foreground mb-4">
              Enroll in courses and start learning to track your progress.
            </p>
            <Link to="/">
              <Button>Browse Courses</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ProgressFilters
        courses={courses}
        subjects={subjects}
        selectedCourse={selectedCourse}
        selectedSubject={selectedSubject}
        onCourseChange={setSelectedCourse}
        onSubjectChange={setSelectedSubject}
        onReset={() => {
          setSelectedCourse("all");
          setSelectedSubject("all");
        }}
        onCourseChangeCallback={() => setSelectedSubject("all")}
      />

      {/* Current Progress Summary */}
      {progressData && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Overall</span>
              </div>
              <p className="text-2xl font-bold">{progressData.currentProgress}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BookOpen className="h-4 w-4" />
                <span className="text-xs font-medium">Chapters</span>
              </div>
              <p className="text-xl font-semibold">{progressData.totals.chaptersCompleted}/{progressData.totals.totalChapters}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Video className="h-4 w-4" />
                <span className="text-xs font-medium">Videos</span>
              </div>
              <p className="text-xl font-semibold">{progressData.totals.videosWatched}/{progressData.totals.totalVideos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <FileCheck className="h-4 w-4" />
                <span className="text-xs font-medium">MCQs</span>
              </div>
              <p className="text-xl font-semibold">{progressData.totals.mcqsCompleted}/{progressData.totals.totalMcqs}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <GraduationCap className="h-4 w-4" />
                <span className="text-xs font-medium">Exams</span>
              </div>
              <p className="text-xl font-semibold">{progressData.totals.examsCompleted}/{progressData.totals.totalExams}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Award className="h-4 w-4" />
                <span className="text-xs font-medium">Proficiency</span>
              </div>
              <p className="text-xl font-semibold">{progressData.totals.proficiencyCompleted}/{progressData.totals.totalProficiencyTests}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ClipboardList className="h-4 w-4" />
                <span className="text-xs font-medium">Assignments</span>
              </div>
              <p className="text-xl font-semibold">{progressData.totals.assignmentsCompleted}/{progressData.totals.totalAssignments}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CalendarCheck className="h-4 w-4" />
                <span className="text-xs font-medium">Attendance</span>
              </div>
              <p className="text-xl font-semibold">{progressData.totals.presentClasses}/{progressData.totals.totalClasses}</p>
              <p className="text-xs text-muted-foreground">{progressData.totals.attendancePercentage}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Progress Trend (Last 30 Days)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Chapter-based progress: Each chapter's progress = average of its Videos, MCQs, Exams & Assignments completion
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingProgress ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : progressData && progressData.trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressData.trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="displayDate" 
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  className="text-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="progress" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                  name="Overall Progress (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No progress data available for the selected period.</p>
              <p className="text-sm text-muted-foreground mt-1">Complete chapters, watch videos, or take tests to see your progress.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chapter-wise Progress */}
      {progressData && progressData.chapterDetails && progressData.chapterDetails.length > 0 && (
        <Card>
          <CardHeader>
            <Collapsible open={showChapterDetails} onOpenChange={setShowChapterDetails}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Chapter-wise Progress
                  </CardTitle>
                  <Button variant="ghost" size="sm">
                    {showChapterDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-4 space-y-4">
                  {progressData.chapterDetails.map((chapter: any) => (
                    <div key={chapter.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium">{chapter.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">({chapter.subjectName})</span>
                        </div>
                        <span className="text-sm font-semibold text-primary">{chapter.progress}%</span>
                      </div>
                      <Progress value={chapter.progress} className="h-2 mb-3" />
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Video className="h-3 w-3" />
                          <span>Videos: {chapter.videos.completed}/{chapter.videos.total}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <FileCheck className="h-3 w-3" />
                          <span>MCQs: {chapter.mcqs.completed}/{chapter.mcqs.total}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          <span>Exams: {chapter.exams.completed}/{chapter.exams.total}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Award className="h-3 w-3" />
                          <span>Proficiency: {chapter.proficiencyTests.completed}/{chapter.proficiencyTests.total}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ClipboardList className="h-3 w-3" />
                          <span>Assign: {chapter.assignments.completed}/{chapter.assignments.total}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
        </Card>
      )}

      {/* Progress Breakdown by Component */}
      {progressData && progressData.currentProgress > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Component Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <Video className="h-4 w-4" /> Video Completion
                </span>
                <span className="text-sm text-muted-foreground">{progressData.breakdown.videos}%</span>
              </div>
              <Progress value={progressData.breakdown.videos} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <FileCheck className="h-4 w-4" /> MCQ Completion
                </span>
                <span className="text-sm text-muted-foreground">{progressData.breakdown.mcqs}%</span>
              </div>
              <Progress value={progressData.breakdown.mcqs} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <GraduationCap className="h-4 w-4" /> Exam Completion
                </span>
                <span className="text-sm text-muted-foreground">{progressData.breakdown.exams}%</span>
              </div>
              <Progress value={progressData.breakdown.exams} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <Award className="h-4 w-4" /> Proficiency Test Completion
                </span>
                <span className="text-sm text-muted-foreground">{progressData.breakdown.proficiencyTests}%</span>
              </div>
              <Progress value={progressData.breakdown.proficiencyTests} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <ClipboardList className="h-4 w-4" /> Assignment Completion
                </span>
                <span className="text-sm text-muted-foreground">{progressData.breakdown.assignments}%</span>
              </div>
              <Progress value={progressData.breakdown.assignments} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject-wise Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Subject-wise Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progressData && progressData.chapterDetails ? (
            (() => {
              // Group chapters by subject and calculate average progress
              const subjectProgress: Record<string, { total: number; count: number }> = {};
              progressData.chapterDetails.forEach((chapter: any) => {
                if (!subjectProgress[chapter.subjectName]) {
                  subjectProgress[chapter.subjectName] = { total: 0, count: 0 };
                }
                subjectProgress[chapter.subjectName].total += chapter.progress;
                subjectProgress[chapter.subjectName].count += 1;
              });

              const subjectList = Object.entries(subjectProgress).map(([name, data]) => ({
                name,
                progress: Math.round((data.total / data.count) * 10) / 10,
              }));

              if (subjectList.length === 0) {
                return (
                  <div className="text-center py-6">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No subject data available yet.</p>
                  </div>
                );
              }

              return subjectList.map((subject) => (
                <div key={subject.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{subject.name}</span>
                    <span className="text-sm text-muted-foreground">{subject.progress}%</span>
                  </div>
                  <Progress value={subject.progress} />
                </div>
              ));
            })()
          ) : (
            <div className="text-center py-6">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No subject data available yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Course Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {student.courses?.map((course: any) => (
          <Card key={course.id}>
            <CardHeader>
              <CardTitle className="text-base">{course.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Overall Progress</span>
                  <span className="font-semibold">{course.progress || 0}%</span>
                </div>
                <Progress value={course.progress || 0} />
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Subjects:</p>
                  <div className="flex flex-wrap gap-2">
                    {course.subjects?.length > 0 ? (
                      course.subjects.map((subject: string) => (
                        <span key={subject} className="text-xs px-2 py-1 bg-muted rounded">
                          {subject}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No subjects assigned</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
