import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, CheckCircle2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TestsFilters } from "./TestsFilters";

export const TestsTab = ({ student }: { student: any }) => {
  const testHistory = student.testHistory || {};
  
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  const [selectedTestType, setSelectedTestType] = useState("all");

  // Extract unique courses and subjects
  const courses = useMemo(() => {
    const uniqueCourses = new Set(student.courses?.map((c: any) => c.name) || []);
    return Array.from(uniqueCourses);
  }, [student.courses]);

  const subjects = useMemo(() => {
    const uniqueSubjects = new Set();
    testHistory.assignments?.forEach((a: any) => {
      if (a.subject) uniqueSubjects.add(a.subject);
    });
    testHistory.quizzes?.forEach((q: any) => {
      if (q.subject) uniqueSubjects.add(q.subject);
    });
    return Array.from(uniqueSubjects);
  }, [testHistory]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    if (!testHistory.assignments) return [];
    let filtered = testHistory.assignments;
    
    if (selectedSubject !== "all") {
      filtered = filtered.filter((a: any) => a.subject === selectedSubject);
    }
    
    if (selectedDateRange !== "all") {
      const days = parseInt(selectedDateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      filtered = filtered.filter((a: any) => new Date(a.submitted_at) >= cutoffDate);
    }
    
    return filtered;
  }, [testHistory.assignments, selectedSubject, selectedDateRange]);

  // Filter quizzes
  const filteredQuizzes = useMemo(() => {
    if (!testHistory.quizzes) return [];
    let filtered = testHistory.quizzes;
    
    if (selectedSubject !== "all") {
      filtered = filtered.filter((q: any) => q.subject === selectedSubject);
    }
    
    return filtered;
  }, [testHistory.quizzes, selectedSubject]);

  const handleReset = () => {
    setSelectedCourse("all");
    setSelectedSubject("all");
    setSelectedDateRange("all");
    setSelectedTestType("all");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <TestsFilters
        courses={courses as string[]}
        subjects={subjects as string[]}
        selectedCourse={selectedCourse}
        selectedSubject={selectedSubject}
        selectedDateRange={selectedDateRange}
        selectedTestType={selectedTestType}
        onCourseChange={setSelectedCourse}
        onSubjectChange={setSelectedSubject}
        onDateRangeChange={setSelectedDateRange}
        onTestTypeChange={setSelectedTestType}
        onReset={handleReset}
      />
      
      {/* DPT Performance */}
      {(selectedTestType === "all" || selectedTestType === "dpt") && testHistory.dpt && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                DPT Streak & Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500">
                    {testHistory.dpt.streak}
                  </p>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{testHistory.dpt.total_tests}</p>
                  <p className="text-sm text-muted-foreground">Total Tests</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{testHistory.dpt.average_score}%</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly DPT Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={testHistory.dpt.weekly_scores.map((score: number, idx: number) => ({
                    day: `Day ${idx + 1}`,
                    score,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assignment History */}
      {(selectedTestType === "all" || selectedTestType === "assignment") && filteredAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assignment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAssignments.map((assignment: any) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted on {new Date(assignment.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={assignment.percentage >= 70 ? "default" : "destructive"}>
                      {assignment.score}/{assignment.total}
                    </Badge>
                    <span className="font-semibold">{assignment.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quizzes */}
      {(selectedTestType === "all" || selectedTestType === "quiz") && filteredQuizzes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quiz Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={filteredQuizzes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="hsl(var(--primary))" name="Score" />
                <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
