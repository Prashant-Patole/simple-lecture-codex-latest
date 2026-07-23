import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, BookOpen, Brain, FileCheck, Video, TestTube } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export const ActivityLogTab = ({ student }: { student: any }) => {
  const [filter, setFilter] = useState("all");
  const activityLog = student.activityLog || [];

  const getActivityIcon = (type: string) => {
    const icons: Record<string, any> = {
      login: LogIn,
      course_access: BookOpen,
      ai_query: Brain,
      test_complete: TestTube,
      assignment_submit: FileCheck,
      live_class_join: Video,
    };
    const Icon = icons[type] || BookOpen;
    return <Icon className="h-4 w-4" />;
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      login: "text-blue-500",
      course_access: "text-green-500",
      ai_query: "text-purple-500",
      test_complete: "text-orange-500",
      assignment_submit: "text-pink-500",
      live_class_join: "text-cyan-500",
    };
    return colors[type] || "text-gray-500";
  };

  const filteredLog =
    filter === "all"
      ? activityLog
      : activityLog.filter((activity: any) => activity.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity Timeline</h3>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="course_access">Course Access</SelectItem>
            <SelectItem value="ai_query">AI Queries</SelectItem>
            <SelectItem value="test_complete">Tests</SelectItem>
            <SelectItem value="assignment_submit">Assignments</SelectItem>
            <SelectItem value="live_class_join">Live Classes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity ({filteredLog.length} events)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activities found for this filter
              </p>
            ) : (
              filteredLog.map((activity: any, idx: number) => (
                <div key={idx} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className={`mt-1 ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <Badge variant="outline" className="text-xs">
                        {activity.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.timestamp), "MMM dd, yyyy HH:mm:ss")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
