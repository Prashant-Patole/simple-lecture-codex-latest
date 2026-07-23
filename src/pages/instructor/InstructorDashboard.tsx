import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, BookOpen, Calendar, Clock, Users, ArrowRight } from "lucide-react";
import { useInstructorTodayClasses, useInstructorUpcomingClasses } from "@/hooks/useInstructorClasses";
import { useInstructorSubjectsAssigned } from "@/hooks/useInstructorSubjectsAssigned";
import { useLogInstructorActivity } from "@/hooks/useLogInstructorActivity";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const { data: todayClasses, isLoading: todayLoading } = useInstructorTodayClasses();
  const { data: upcomingClasses, isLoading: upcomingLoading } = useInstructorUpcomingClasses();
  const { data: assignedSubjects, isLoading: subjectsLoading } = useInstructorSubjectsAssigned();
  const logActivity = useLogInstructorActivity();

  useEffect(() => {
    logActivity.mutate({
      action: "Viewed dashboard",
      action_type: "VIEW_DASHBOARD",
      metadata: {}
    });
  }, []);

  const liveClasses = todayClasses?.filter(c => c.is_live) || [];
  const stats = [
    {
      title: "Today's Classes",
      value: todayClasses?.length || 0,
      icon: Calendar,
      color: "text-blue-500",
    },
    {
      title: "Live Now",
      value: liveClasses.length,
      icon: Video,
      color: "text-red-500",
    },
    {
      title: "Assigned Subjects",
      value: assignedSubjects?.length || 0,
      icon: BookOpen,
      color: "text-green-500",
    },
    {
      title: "Upcoming Classes",
      value: upcomingClasses?.slice(0, 5).length || 0,
      icon: Clock,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your teaching overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Classes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today's Classes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/instructor/classes")}>
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {todayLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : todayClasses?.length === 0 ? (
            <p className="text-muted-foreground">No classes scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {todayClasses?.map((classItem: any) => (
                <div
                  key={classItem.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${classItem.is_live ? 'bg-red-100' : 'bg-primary/10'}`}>
                      <Video className={`h-5 w-5 ${classItem.is_live ? 'text-red-500' : 'text-primary'}`} />
                    </div>
                    <div>
                      <p className="font-medium">{classItem.subject?.name || 'Class'}</p>
                      <p className="text-sm text-muted-foreground">
                        {classItem.course?.name} • {format(new Date(classItem.scheduled_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {classItem.is_live ? (
                      <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {format(new Date(classItem.scheduled_at), 'h:mm a')}
                      </Badge>
                    )}
                    <Button 
                      size="sm" 
                      onClick={() => navigate("/instructor/classes")}
                    >
                      {classItem.is_live ? "Join" : "View"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Subjects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My Subjects</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/instructor/subjects")}>
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {subjectsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : assignedSubjects?.length === 0 ? (
            <p className="text-muted-foreground">No subjects assigned yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedSubjects?.slice(0, 6).map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate("/instructor/subjects")}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{item.subject?.name}</p>
                      <p className="text-xs text-muted-foreground">{item.course?.name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
