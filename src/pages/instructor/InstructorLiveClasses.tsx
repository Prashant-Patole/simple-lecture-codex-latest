import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, VideoOff, Radio, Users, Loader2, Calendar } from "lucide-react";
import { useInstructorClasses, useInstructorTodayClasses } from "@/hooks/useInstructorClasses";
import { useBBBMeeting, useBBBMeetingInfo } from "@/hooks/useBBBMeeting";
import { useBBBConfigured } from "@/hooks/useBBBSettings";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLogInstructorActivity } from "@/hooks/useLogInstructorActivity";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

export default function InstructorLiveClasses() {
  const [activeTab, setActiveTab] = useState("today");
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { isConfigured: isBBBConfigured } = useBBBConfigured();
  const { createMeeting, endMeeting, joinMeeting } = useBBBMeeting();
  const logActivity = useLogInstructorActivity();

  const { data: todayClasses, isLoading: todayLoading, refetch: refetchToday } = useInstructorTodayClasses();
  const { data: upcomingClasses, isLoading: upcomingLoading } = useInstructorClasses("upcoming");
  const { data: pastClasses, isLoading: pastLoading } = useInstructorClasses("past");

  useEffect(() => {
    logActivity.mutate({
      action: "Viewed live classes",
      action_type: "VIEW_CLASSES",
      metadata: {}
    });
  }, []);

  const handleStartMeeting = async (classItem: any) => {
    try {
      await createMeeting.mutateAsync({
        scheduledClassId: classItem.id,
        meetingName: classItem.subject?.name || "Live Class",
      });
      
      await logActivity.mutateAsync({
        action: `Started meeting for ${classItem.subject?.name}`,
        action_type: "MEETING_CREATED",
        metadata: { 
          scheduled_class_id: classItem.id,
          subject_name: classItem.subject?.name,
          course_name: classItem.course?.name
        }
      });
      
      toast.success("Meeting started successfully");
      refetchToday();
    } catch (error) {
      toast.error("Failed to start meeting");
    }
  };

  const handleJoinMeeting = async (classItem: any) => {
    try {
      const joinUrl = await joinMeeting.mutateAsync({
        scheduledClassId: classItem.id,
        role: "moderator",
        fullName: currentUser?.profile?.full_name || currentUser?.email || "Instructor",
      });
      
      await logActivity.mutateAsync({
        action: `Joined meeting for ${classItem.subject?.name}`,
        action_type: "MEETING_JOINED",
        metadata: { 
          scheduled_class_id: classItem.id,
          subject_name: classItem.subject?.name
        }
      });
      
      window.open(joinUrl, "_blank");
    } catch (error) {
      toast.error("Failed to join meeting");
    }
  };

  const handleEndMeeting = async (classItem: any) => {
    try {
      await endMeeting.mutateAsync(classItem.id);
      
      await logActivity.mutateAsync({
        action: `Ended meeting for ${classItem.subject?.name}`,
        action_type: "MEETING_ENDED",
        metadata: { 
          scheduled_class_id: classItem.id,
          subject_name: classItem.subject?.name
        }
      });
      
      toast.success("Meeting ended successfully");
      refetchToday();
    } catch (error) {
      toast.error("Failed to end meeting");
    }
  };

  const ClassCard = ({ classItem }: { classItem: any }) => {
    const { data: meetingInfo } = useBBBMeetingInfo(classItem.id);
    const isLive = classItem.is_live;
    const isPast = new Date(classItem.scheduled_at) < new Date();

    return (
      <Card className={`transition-all ${isLive ? 'border-red-500 border-2' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{classItem.subject?.name || "Class"}</CardTitle>
            {isLive && (
              <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                <Radio className="h-3 w-3" />
                LIVE
                {meetingInfo?.participantCount !== undefined && (
                  <span className="ml-1 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {meetingInfo.participantCount}
                  </span>
                )}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{classItem.course?.name}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(classItem.scheduled_at), "PPP 'at' h:mm a")}
          </div>

          {isBBBConfigured && !isPast && (
            <div className="space-y-2">
              {!isLive ? (
                <Button
                  className="w-full"
                  onClick={() => handleStartMeeting(classItem)}
                  disabled={createMeeting.isPending}
                >
                  {createMeeting.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Radio className="h-4 w-4 mr-2" />
                  )}
                  Start Meeting
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleJoinMeeting(classItem)}
                    disabled={joinMeeting.isPending}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Join as Moderator
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleEndMeeting(classItem)}
                    disabled={endMeeting.isPending}
                  >
                    {endMeeting.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <VideoOff className="h-4 w-4 mr-2" />
                    )}
                    End Meeting
                  </Button>
                </>
              )}
            </div>
          )}

          {!isBBBConfigured && (
            <p className="text-sm text-muted-foreground text-center py-2">
              BBB not configured. Contact admin.
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderClasses = (classes: any[] | undefined, isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!classes || classes.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No classes found.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((classItem) => (
          <ClassCard key={classItem.id} classItem={classItem} />
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">My Classes</h1>
        <p className="text-muted-foreground">Manage your live classes and meetings.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          {renderClasses(todayClasses, todayLoading)}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {renderClasses(upcomingClasses, upcomingLoading)}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {renderClasses(pastClasses, pastLoading)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
