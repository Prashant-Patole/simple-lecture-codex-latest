import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Video, Clock, TrendingUp, Sparkles, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMyClassesData } from "@/hooks/useMyClassesData";
import { format } from "date-fns";

interface MyAILearningTabProps {
  student: any;
}

export const MyAILearningTab = ({ student }: MyAILearningTabProps) => {
  const navigate = useNavigate();
  const { data: classesData, isLoading } = useMyClassesData(student?.id);

  const hasClassData = classesData && classesData.totalScheduled > 0;
  const hasAIData = classesData && classesData.aiLectureTimeMinutes > 0;

  // Empty state - no class data and no AI data
  if (!isLoading && !hasClassData && !hasAIData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Start Your Learning Journey</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Attend live classes or watch AI lectures to see your analytics here.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Pie chart data for attendance status
  const attendanceChartData = [
    { name: "Present", value: classesData?.presentCount || 0, fill: "#22c55e" },
    { name: "Absent", value: classesData?.absentCount || 0, fill: "#ef4444" },
  ];

  const chartConfig = {
    present: { label: "Present", color: "#22c55e" },
    absent: { label: "Absent", color: "#ef4444" },
  };

  // Format time display
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Live Classes Attended */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Live Classes Attended</p>
                <p className="text-2xl font-bold">
                  {classesData?.totalAttended || 0}
                  <span className="text-sm text-muted-foreground font-normal">
                    {" "}of {classesData?.totalScheduled || 0}
                  </span>
                </p>
              </div>
            </div>
            <Progress 
              value={classesData?.totalScheduled ? (classesData.totalAttended / classesData.totalScheduled) * 100 : 0} 
              className="h-2" 
            />
          </CardContent>
        </Card>

        {/* Live Class Time */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Live Class Time</p>
                <p className="text-2xl font-bold">{formatTime(classesData?.totalTimeMinutes || 0)}</p>
                <p className="text-xs text-muted-foreground">
                  {classesData?.totalTimeMinutes || 0} minutes total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Classes Attendance Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Live Classes Attendance Rate</p>
                <p className="text-2xl font-bold">{classesData?.attendanceRate || 0}%</p>
              </div>
            </div>
            <Progress value={classesData?.attendanceRate || 0} className="h-2" />
          </CardContent>
        </Card>

        {/* AI Lectures Time - NEW */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Lectures Time</p>
                <p className="text-2xl font-bold">{formatTime(classesData?.aiLectureTimeMinutes || 0)}</p>
                <p className="text-xs text-muted-foreground">
                  Time spent on AI lectures
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {attendanceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Present: {classesData?.presentCount || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Absent: {classesData?.absentCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {classesData?.recentClasses && classesData.recentClasses.length > 0 ? (
              <div className="space-y-3">
                {classesData.recentClasses.map((classItem) => (
                  <div
                    key={classItem.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {classItem.status === 'present' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{classItem.subject}</p>
                        {(classItem.chapter_title || classItem.topic_title) && (
                          <p className="text-xs text-primary/80">
                            {classItem.chapter_title || classItem.topic_title}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {classItem.scheduled_at 
                            ? format(new Date(classItem.scheduled_at), 'MMM d, yyyy • h:mm a')
                            : 'Date not available'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        classItem.status === 'present' 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-red-500/10 text-red-600'
                      }`}>
                        {classItem.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                      {classItem.status === 'present' && classItem.duration_seconds && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.round(classItem.duration_seconds / 60)} min
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No recent classes found
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
