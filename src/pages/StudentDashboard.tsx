import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { SEOHead } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MyOverviewTab } from "@/components/student/tabs/MyOverviewTab";
import { MyProgressTab } from "@/components/student/tabs/MyProgressTab";
import { MyTestsTab } from "@/components/student/tabs/MyTestsTab";
import { AttendanceCalendar } from "@/components/admin/students/AttendanceCalendar";
import { TimetableTab } from "@/components/admin/students/tabs/TimetableTab";
import { MyAILearningTab } from "@/components/student/tabs/MyAILearningTab";
import { MyCoursesTab } from "@/components/student/tabs/MyCoursesTab";
import { EngagementTab } from "@/components/admin/students/tabs/EngagementTab";
import { Mail, Phone, Calendar, User, BarChart3, FileText, CalendarDays, Clock, Brain, Activity, ArrowLeft, BookOpen } from "lucide-react";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/mobile/BottomNav";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StudentDashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useDailyAttendanceHistory } from "@/hooks/useDailyAttendance";
import { Skeleton } from "@/components/ui/skeleton";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: student, isLoading: dataLoading, error } = useCurrentStudent();
  const { data: attendanceHistory, isLoading: attendanceLoading } = useDailyAttendanceHistory();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Show skeleton while checking auth or loading data
  if (authLoading || dataLoading) {
    return <StudentDashboardSkeleton />;
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return <StudentDashboardSkeleton />;
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <CardContent className="text-center">
            <p className="text-lg font-semibold mb-4">Unable to load student data</p>
            <p className="text-sm text-muted-foreground mb-4">
              {error?.message || "Student profile not found"}
            </p>
            <Button onClick={() => navigate("/auth")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEOHead title="My Dashboard | SimpleLecture" description="Student learning dashboard" />
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <DashboardHeader />

        {/* Profile Card */}
        <div className="container mx-auto px-4 py-6">
          {/* Back to Dashboard Link */}
          <Link to="/dashboard">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={student.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">{student.full_name[0]}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{student.full_name}</h2>
                    <Badge variant={student.status === "active" ? "default" : "secondary"}>
                      {student.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{student.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{student.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Enrolled: {student.enrollment_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Last active: {new Date(student.last_active).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-2">
              <TabsTrigger value="overview" className="gap-2">
                <User className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                My Progress
              </TabsTrigger>
              <TabsTrigger value="tests" className="gap-2">
                <FileText className="h-4 w-4" />
                My Tests
              </TabsTrigger>
              <TabsTrigger value="attendance" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                My Attendance
              </TabsTrigger>
              <TabsTrigger value="timetable" className="gap-2">
                <Clock className="h-4 w-4" />
                My Timetable
              </TabsTrigger>
              <TabsTrigger value="courses" className="gap-2">
                <BookOpen className="h-4 w-4" />
                My Courses
              </TabsTrigger>
              <TabsTrigger value="ai-learning" className="gap-2">
                <Brain className="h-4 w-4" />
                AI & Learning
              </TabsTrigger>
              <TabsTrigger value="engagement" className="gap-2">
                <Activity className="h-4 w-4" />
                My Engagement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <MyOverviewTab student={student} />
            </TabsContent>

            <TabsContent value="progress">
              <MyProgressTab student={student} />
            </TabsContent>

            <TabsContent value="tests">
              <MyTestsTab student={student} />
            </TabsContent>

            <TabsContent value="attendance">
              <Card>
                <CardContent className="p-6">
                  {attendanceLoading ? (
                    <Skeleton className="h-[400px] w-full" />
                  ) : (
                    <AttendanceCalendar 
                      attendanceData={attendanceHistory || []}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timetable">
              <TimetableTab student={student} />
            </TabsContent>

            <TabsContent value="courses">
              <MyCoursesTab student={student} />
            </TabsContent>

            <TabsContent value="ai-learning">
              <MyAILearningTab student={student} />
            </TabsContent>

            <TabsContent value="engagement">
              <EngagementTab student={student} />
            </TabsContent>
          </Tabs>
        </div>

        <Footer />
        <BottomNav />
      </div>
    </>
  );
};

export default StudentDashboard;
