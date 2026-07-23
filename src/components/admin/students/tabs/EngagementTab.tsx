import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestScoreGauge } from "../TestScoreGauge";
import { AlertCircle, TrendingUp, Video } from "lucide-react";
import { useChapterWiseProgress } from "@/hooks/useChapterWiseProgress";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const EngagementTab = ({ student }: { student: any }) => {
  const {
    activity_score = 0,
    activity_trends = [],
    live_classes = {},
    ai_video_usage = {},
  } = student;

  // State for selected course
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");

  // Get enrolled courses from student data
  const enrolledCourses = student.courses || [];
  const courseIds = enrolledCourses.map((c: any) => c.id);

  // Fetch chapter-wise progress for lecture counts
  const { data: chapterProgress } = useChapterWiseProgress(courseIds);

  // Calculate video stats based on selected course
  const videoStats = useMemo(() => {
    if (!chapterProgress || chapterProgress.length === 0) {
      // Fallback to aggregated data from props
      return {
        total: ai_video_usage.total_videos || 0,
        watched: ai_video_usage.watched_count || 0,
        watchTimeMinutes: ai_video_usage.total_watch_time_minutes || 0,
        completionRate: ai_video_usage.completion_rate || 0,
      };
    }

    let totalLectures = 0;
    let watchedLectures = 0;

    chapterProgress.forEach((course: any) => {
      // Filter by course if one is selected
      if (selectedCourseId !== "all" && course.id !== selectedCourseId) return;
      
      (course.subjects || []).forEach((subject: any) => {
        (subject.chapters || []).forEach((chapter: any) => {
          totalLectures += chapter.lectures?.total || 0;
          watchedLectures += chapter.lectures?.watched || 0;
        });
      });
    });

    const completionRate = totalLectures > 0 
      ? Math.round((watchedLectures / totalLectures) * 100) 
      : 0;

    // For watch time, use the original data (not course-specific currently)
    const watchTimeMinutes = selectedCourseId === "all" 
      ? ai_video_usage.total_watch_time_minutes || 0
      : Math.round((ai_video_usage.total_watch_time_minutes || 0) * (watchedLectures / Math.max(1, ai_video_usage.watched_count || 1)));

    return {
      total: totalLectures,
      watched: watchedLectures,
      watchTimeMinutes,
      completionRate,
    };
  }, [chapterProgress, selectedCourseId, ai_video_usage]);

  // Use real activity trend data with dynamic dates
  const activityTrend = activity_trends.length > 0 
    ? activity_trends.map((t: any) => ({
        day: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: t.score,
      }))
    : (() => {
        // Generate dynamic dates for last 30 days if no data
        const today = new Date();
        return Array.from({ length: 30 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - (29 - i));
          return {
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: 0,
          };
        });
      })();

  // Video completion distribution - use calculated stats
  const videoCompletionData = [
    { name: "Completed", value: videoStats.watched, color: "#22c55e" },
    { name: "In Progress", value: Math.max(0, videoStats.total - videoStats.watched), color: "#f59e0b" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Activity Score Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Overall Test Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <TestScoreGauge score={activity_score} size="lg" />
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">Class Average: 75</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold text-green-500">
                  {activity_score >= 75 ? "Above Average" : "Below Average"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Score Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={activityTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" interval={4} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Live Class Participation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Live Class Participation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{live_classes.attended || 0}</p>
              <p className="text-xs text-muted-foreground">Attended</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{live_classes.missed || 0}</p>
              <p className="text-xs text-muted-foreground">Missed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{live_classes.attendance_percentage || 0}%</p>
              <p className="text-xs text-muted-foreground">Attendance</p>
            </div>
          </div>

          {live_classes.missed > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Missed Classes Alert</p>
                  <p className="text-xs text-muted-foreground">{live_classes.missed} classes missed recently</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Course Selection for Video Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Video Learning</h3>
        <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select Course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {enrolledCourses.map((course: any) => (
              <SelectItem key={course.id} value={course.id}>
                {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* AI Video Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-500" />
              AI Video Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Videos Watched</span>
                <span className="font-semibold">{videoStats.watched} / {videoStats.total}</span>
              </div>
              <Progress value={videoStats.total > 0 ? (videoStats.watched / videoStats.total) * 100 : 0} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-lg font-bold">{Math.floor(videoStats.watchTimeMinutes / 60)}h</p>
                <p className="text-xs text-muted-foreground">Watch Time</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-lg font-bold">{videoStats.completionRate}%</p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Video Completion Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={videoCompletionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {videoCompletionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
