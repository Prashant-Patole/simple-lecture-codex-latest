import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export const SubjectProgressTable = () => {
  const { stats, isLoading } = useDashboardStats();
  const [selectedCourse, setSelectedCourse] = useState<string>("All");

  const courseNames = useMemo(() => {
    const names = (stats.courses || []).map((c: any) => c?.courses?.name).filter(Boolean);
    return ["All", ...Array.from(new Set(names))];
  }, [stats.courses]);

  const subjects = useMemo(() => {
    const entries = Object.entries(stats.subjectProgress);
    if (selectedCourse === "All") return entries;
    const selected = (stats.courses || []).find((c: any) => c?.courses?.name === selectedCourse);
    const allowed = new Set<string>(((selected?.courses?.subjects as any[]) || []).map(String));
    return entries.filter(([subject]) => allowed.has(subject));
  }, [stats.subjectProgress, stats.courses, selectedCourse]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Subject Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
    <CardHeader className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Subject Progress
        </CardTitle>
        <div className="w-40">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              {courseNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </CardHeader>
      <CardContent>
        {subjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No progress data available yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map(([subject, data]) => (
              <div key={subject}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{subject}</span>
                  <span className="text-sm font-bold">{data.percentage}%</span>
                </div>
                <Progress 
                  value={data.percentage} 
                  className={`h-2 ${
                    data.percentage >= 75 
                      ? '[&>div]:bg-green-500' 
                      : data.percentage >= 50 
                      ? '[&>div]:bg-yellow-500' 
                      : '[&>div]:bg-red-500'
                  }`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {data.completed} of {data.total} chapters completed
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
