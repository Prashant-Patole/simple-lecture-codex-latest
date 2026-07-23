import { BookOpen, Brain, Target, Clock, Video, Activity, FileDown, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TestScoreGauge } from "../TestScoreGauge";

export const OverviewTab = ({ student }: { student: any }) => {
  const quickStats = [
    {
      label: "Overall Progress",
      value: `${student.total_progress.toFixed(0)}%`,
      icon: Target,
      color: "text-blue-500",
    },
    {
      label: "Total Tests",
      value: student.tests_taken,
      icon: BookOpen,
      color: "text-green-500",
    },
    {
      label: "AI Queries",
      value: student.ai_queries,
      icon: Brain,
      color: "text-purple-500",
    },
    {
      label: "Avg Score",
      value: `${student.avg_test_score}%`,
      icon: Target,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enrolled Courses */}
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Courses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {student.courses.map((course: any) => (
            <div key={course.id} className="space-y-2 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{course.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {course.subjects.join(", ")}
                  </p>
                </div>
                <Badge>{course.progress}%</Badge>
              </div>
              <Progress value={course.progress} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Live Class Attendance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Live Class Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">
                  {student.live_classes?.attended || 0} / {student.live_classes?.total_scheduled || 0}
                </p>
                <p className="text-sm text-muted-foreground">Classes Attended</p>
              </div>
              <Badge 
                variant={
                  (student.live_classes?.attendance_percentage || 0) >= 85 ? "default" :
                  (student.live_classes?.attendance_percentage || 0) >= 70 ? "secondary" : "destructive"
                }
                className="text-lg px-4 py-2"
              >
                {student.live_classes?.attendance_percentage || 0}%
              </Badge>
            </div>
            
            {student.live_classes?.missed > 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-semibold text-destructive">
                  Missed: {student.live_classes.missed} classes
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Recent Classes</p>
              {student.live_classes?.recent_classes?.slice(0, 5).map((cls: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2">
                    {cls.attended ? (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{cls.subject}</p>
                      <p className="text-xs text-muted-foreground">{cls.topic}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(cls.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Video Utilization Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-500" />
            AI Video Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{student.ai_video_usage?.watched_count || 0}</p>
                <p className="text-xs text-muted-foreground">Watched</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{Math.floor((student.ai_video_usage?.total_watch_time_minutes || 0) / 60)}h</p>
                <p className="text-xs text-muted-foreground">Watch Time</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{student.ai_video_usage?.completion_rate || 0}%</p>
                <p className="text-xs text-muted-foreground">Completion</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span className="font-semibold">
                  {student.ai_video_usage?.watched_count || 0} / {student.ai_video_usage?.total_videos || 0}
                </span>
              </div>
              <Progress 
                value={(student.ai_video_usage?.watched_count / student.ai_video_usage?.total_videos) * 100 || 0} 
                className="h-2" 
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Recent Videos</p>
              {student.ai_video_usage?.recent_videos?.slice(0, 3).map((video: any, idx: number) => (
                <div key={idx} className="p-2 border rounded text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium line-clamp-1">{video.title}</p>
                      <p className="text-xs text-muted-foreground">{video.subject}</p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {video.watched_percentage}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Test Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            <TestScoreGauge score={student.activity_score || 0} size="md" />
            
            <div className="w-full mt-6 space-y-3">
              <p className="text-sm font-semibold">Breakdown by Category</p>
              {Object.entries(student.activity_breakdown || {}).map(([key, value]: [string, any]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="font-semibold">{value}%</span>
                  </div>
                  <Progress value={value} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="w-full justify-start">
              <UserPlus className="h-4 w-4 mr-2" />
              Create Follow-up
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Clock className="h-4 w-4 mr-2" />
              View Timetable
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileDown className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Areas of Improvement */}
      {student.areas_of_improvement && student.areas_of_improvement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Areas of Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {student.areas_of_improvement.map((area: string, idx: number) => (
                <Badge key={idx} variant="outline">
                  {area}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {student.activityLog && student.activityLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {student.activityLog.slice(0, 5).map((activity: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p>{activity.description}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
