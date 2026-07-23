import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ProgressFilters } from "./ProgressFilters";

export const ProgressTab = ({ student }: { student: any }) => {
  const progressData = student.progressData || {};
  
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");

  // Extract unique courses and subjects
  const courses = useMemo(() => {
    const uniqueCourses = new Set(student.courses?.map((c: any) => c.name) || []);
    return Array.from(uniqueCourses);
  }, [student.courses]);

  const subjects = useMemo(() => {
    const uniqueSubjects = new Set();
    progressData.chapter_completion?.forEach((chapter: any) => {
      uniqueSubjects.add(chapter.subject);
    });
    Object.keys(progressData.subject_performance || {}).forEach((subject) => {
      uniqueSubjects.add(subject);
    });
    return Array.from(uniqueSubjects);
  }, [progressData]);

  // Filter chapter completion
  const filteredChapters = useMemo(() => {
    if (!progressData.chapter_completion) return [];
    return progressData.chapter_completion.filter((chapter: any) => {
      if (selectedSubject !== "all" && chapter.subject !== selectedSubject) return false;
      return true;
    });
  }, [progressData.chapter_completion, selectedSubject]);

  // Filter subject performance
  const filteredSubjectPerformance = useMemo(() => {
    if (!progressData.subject_performance) return [];
    return Object.entries(progressData.subject_performance)
      .filter(([subject]) => selectedSubject === "all" || subject === selectedSubject)
      .map(([subject, score]) => ({ subject, score }));
  }, [progressData.subject_performance, selectedSubject]);

  const handleReset = () => {
    setSelectedCourse("all");
    setSelectedSubject("all");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ProgressFilters
        courses={courses as string[]}
        subjects={subjects as string[]}
        selectedCourse={selectedCourse}
        selectedSubject={selectedSubject}
        onCourseChange={setSelectedCourse}
        onSubjectChange={setSelectedSubject}
        onReset={handleReset}
      />
      {/* Overall Progress Timeline */}
      {progressData.overall_progress_timeline && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressData.overall_progress_timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="progress"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Subject Performance */}
      {filteredSubjectPerformance.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Subject-wise Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredSubjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="score" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strength & Weakness Radar</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={filteredSubjectPerformance}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Performance"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No subject performance data available for selected filters.
          </CardContent>
        </Card>
      )}

      {/* Chapter Completion */}
      {filteredChapters.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Chapter-wise Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredChapters.map((chapter: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {chapter.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">{chapter.chapter}</span>
                      <span className="text-sm text-muted-foreground">
                        ({chapter.subject})
                      </span>
                    </div>
                    {chapter.score && (
                      <span className="text-sm font-medium">{chapter.score}%</span>
                    )}
                  </div>
                  <Progress value={chapter.progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No chapter completion data available for selected filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
};
