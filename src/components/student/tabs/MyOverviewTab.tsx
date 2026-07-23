import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, BookOpen, Trophy, TrendingUp, Clock, Target, FolderOpen, CalendarCheck, Flame, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDPT } from "@/hooks/useDPT";
import { useDailyAttendance } from "@/hooks/useDailyAttendance";
import { useMyTests } from "@/hooks/useMyTests";
import { useDashboardCourseDetails } from "@/hooks/useDashboardCourseDetails";

interface MyOverviewTabProps {
  student: any;
}

export const MyOverviewTab = ({ student }: MyOverviewTabProps) => {
  const { totalTests, averageScore, streak: dppStreak } = useDPT();
  const { percentage: attendancePercentage, streak, last7Days, daysPresent, totalDays } = useDailyAttendance('web');
  const { paperStats } = useMyTests();
  const { data: courses } = useDashboardCourseDetails();
  
  // Flatten all subjects from all courses
  const allSubjects = courses?.flatMap(c => c.subjects) || [];
  
  // Calculate overall progress from actual content consumption
  const overallProgress = allSubjects.length > 0
    ? Math.round(allSubjects.reduce((acc, s) => acc + s.overallPercentage, 0) / allSubjects.length)
    : 0;
  
  const hasClasses = (student.live_classes?.recent_classes?.length || 0) > 0;
  const hasCourses = (courses?.length || 0) > 0;
  const hasAreasOfImprovement = (student.areas_of_improvement?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Score</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paperStats.avgScore}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {paperStats.total} tests completed
            </p>
            <Progress value={paperStats.avgScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallProgress}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {allSubjects.length} subjects
            </p>
            <Progress value={overallProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solved DPPs</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTests}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {averageScore}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Attendance</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendancePercentage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {daysPresent}/{totalDays} days this month
            </p>
            <div className="flex items-center gap-1 mt-2">
              {last7Days.slice().reverse().map((day, idx) => (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-full ${day.present ? 'bg-primary' : 'bg-muted'}`}
                  title={day.date}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DPP Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {dppStreak} <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Complete DPPs daily! 🔥
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enrolled Courses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            My Courses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasCourses ? (
            courses?.map((course) => {
              const courseProgress = course.subjects.length > 0
                ? Math.round(course.subjects.reduce((acc, s) => acc + s.overallPercentage, 0) / course.subjects.length)
                : 0;
              return (
                <div key={course.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{course.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {course.subjects.length > 0 ? course.subjects.map(s => s.subjectName).join(", ") : "No subjects assigned"}
                      </p>
                    </div>
                    <Badge variant="secondary">{courseProgress}%</Badge>
                  </div>
                  <Progress value={courseProgress} />
                </div>
              );
            })
          ) : (
            <div className="text-center py-6">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-3">You haven't enrolled in any courses yet.</p>
              <Link to="/">
                <Button variant="outline" size="sm">Browse Courses</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Areas of Improvement */}
      {hasAreasOfImprovement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Areas to Focus On
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {student.areas_of_improvement.map((area: string, index: number) => (
                <Badge key={index} variant="outline">
                  {area}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasClasses ? (
            student.live_classes.recent_classes.slice(0, 3).map((cls: any) => (
              <div key={cls.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{cls.topic}</p>
                  <p className="text-xs text-muted-foreground">{cls.subject}</p>
                </div>
                <div className="text-right">
                  <Badge variant={cls.attended ? "default" : "destructive"} className="text-xs">
                    {cls.attended ? "Attended" : "Missed"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(cls.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No recent class activity yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your class attendance will appear here once you start attending.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
