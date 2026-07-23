import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAttendanceStats } from '@/hooks/useAttendanceStats';
import { CheckCircle, Clock, BookOpen, TrendingUp } from 'lucide-react';

interface AttendanceDashboardProps {
  studentId?: string;
}

export const AttendanceDashboard = ({ studentId }: AttendanceDashboardProps) => {
  const { data, isLoading } = useAttendanceStats(studentId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  const { overall, byCourse } = data || { overall: { totalClasses: 0, attendedClasses: 0, percentage: 0, totalDurationSeconds: 0 }, byCourse: [] };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
                <p className={`text-2xl font-bold ${getPercentageColor(overall.percentage)}`}>
                  {overall.percentage}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Classes Attended</p>
                <p className="text-2xl font-bold">{overall.attendedClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{overall.totalClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Time</p>
                <p className="text-2xl font-bold">{formatDuration(overall.totalDurationSeconds)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Course Breakdown */}
      {byCourse.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance by Course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byCourse.map((course) => (
              <div key={course.courseId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{course.courseName}</span>
                  <span className={`text-sm font-semibold ${getPercentageColor(course.percentage)}`}>
                    {course.percentage}% ({course.attendedClasses}/{course.totalClasses})
                  </span>
                </div>
                <Progress value={course.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {byCourse.length === 0 && overall.totalClasses === 0 && (
        <Card className="p-8 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Attendance Data</h3>
          <p className="text-muted-foreground">Your attendance will be recorded when you join live classes.</p>
        </Card>
      )}
    </div>
  );
};
