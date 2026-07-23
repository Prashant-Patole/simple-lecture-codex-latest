import { ArrowLeft, Mail, Phone, Calendar, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./tabs/OverviewTab";
import { ProgressTab } from "./tabs/ProgressTab";
import { TestsTab } from "./tabs/TestsTab";
import { AIActivityTab } from "./tabs/AIActivityTab";
import { FollowupsTab } from "./tabs/FollowupsTab";
import { ActivityLogTab } from "./tabs/ActivityLogTab";
import { TimetableTab } from "./tabs/TimetableTab";
import { EngagementTab } from "./tabs/EngagementTab";
import { format } from "date-fns";

interface StudentDetailViewProps {
  student: any;
  onClose: () => void;
}

export const StudentDetailView = ({ student, onClose }: StudentDetailViewProps) => {
  const enrollDate = new Date(student.enrollment_date);
  const lastActive = new Date(student.last_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <Button variant="ghost" onClick={onClose} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </Button>
      </div>

      {/* Student Profile Card */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={student.avatar_url} />
            <AvatarFallback className="text-2xl">
              {student.full_name.split(" ").map((n: string) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-3xl font-bold">{student.full_name}</h2>
              <p className="text-muted-foreground">Student ID: {student.id}</p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
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
                <span>Joined {format(enrollDate, "MMM dd, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Last active {format(lastActive, "MMM dd, yyyy HH:mm")}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {student.at_risk && <Badge variant="destructive">At Risk</Badge>}
              <Badge variant={student.status === "active" ? "default" : "secondary"}>
                {student.status}
              </Badge>
              {student.followups_pending > 0 && (
                <Badge variant="outline">
                  {student.followups_pending} Pending Follow-ups
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="ai">AI Activity</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab student={student} />
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <ProgressTab student={student} />
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <TestsTab student={student} />
        </TabsContent>

        <TabsContent value="timetable" className="space-y-4">
          <TimetableTab student={student} />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <EngagementTab student={student} />
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <AIActivityTab student={student} />
        </TabsContent>

        <TabsContent value="followups" className="space-y-4">
          <FollowupsTab student={student} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ActivityLogTab student={student} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
