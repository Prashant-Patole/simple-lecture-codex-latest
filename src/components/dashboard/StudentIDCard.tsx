import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useDailyAttendance } from "@/hooks/useDailyAttendance";
import { useDPT } from "@/hooks/useDPT";
import { Badge } from "@/components/ui/badge";
import { Flame, CalendarCheck, Trophy, Target } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";

const defaultWeeklyData = [
  { day: 'Mon', completed: false },
  { day: 'Tue', completed: false },
  { day: 'Wed', completed: false },
  { day: 'Thu', completed: false },
  { day: 'Fri', completed: false },
  { day: 'Sat', completed: false },
  { day: 'Sun', completed: false },
];

export const StudentIDCard = () => {
  const { percentage: attendancePercentage, streak, last7Days, isLoading: attendanceLoading } = useDailyAttendance('web');
  const { data: profile } = useUserProfile();
  const isMobile = useIsMobile();

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U';

  const { averageScore, todayCompleted, weeklyData, streak: dppStreak } = useDPT() as any;

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Welcome Card */}
        <Card className="p-5 bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">
                Hi, {profile?.full_name?.split(' ')[0] || 'Student'}! 👋
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {profile?.email || ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ID: {profile?.id?.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background/80 rounded-xl p-3 text-center border">
              <CalendarCheck className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-primary">{attendancePercentage}%</p>
              <p className="text-[11px] text-muted-foreground">Attendance</p>
            </div>
            <div className="bg-background/80 rounded-xl p-3 text-center border">
              <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{dppStreak}</p>
              <p className="text-[11px] text-muted-foreground">DPP Streak</p>
            </div>
          </div>

          {/* Last 7 days */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {last7Days.slice().reverse().map((day, idx) => (
              <div
                key={idx}
                className={`w-5 h-5 rounded-full ${day.present ? 'bg-primary' : 'bg-muted'}`}
                title={day.date}
              />
            ))}
          </div>
        </Card>

        {/* DPT Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Daily Practice Test
            </h3>
            <Badge variant={todayCompleted ? 'secondary' : 'default'} className="text-xs">
              {todayCompleted ? '✅ Done' : '⏳ Pending'}
            </Badge>
          </div>

          {/* Weekly Calendar */}
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {(weeklyData || defaultWeeklyData).map((d: any, idx: number) => (
              <div key={idx} className={`h-9 rounded-lg flex items-center justify-center text-xs font-medium ${d.completed ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {d.completed ? (d.score ?? '✓') : d.day?.[0]}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold">{averageScore ?? 0}%</p>
              <p className="text-[11px] text-muted-foreground">DPP Average</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold flex items-center justify-center gap-1">
                <Trophy className="h-4 w-4 text-amber-500" />
                {dppStreak}
              </p>
              <p className="text-[11px] text-muted-foreground">Day Streak</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Photo + Details */}
        <div className="flex items-start gap-6">
          <Avatar className="h-28 w-28">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl font-bold mb-1 truncate">
              Welcome, {profile?.full_name || 'Student'}!
            </h2>
            <p className="text-muted-foreground mb-2 text-sm">
              Keep up the great work! Every day is a step closer to your goals.
            </p>
            <p className="text-muted-foreground mb-4 truncate">
              {profile?.email || ""}
            </p>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CalendarCheck className="h-3 w-3" /> Daily Attendance
                </p>
                <p className="text-3xl font-bold text-primary">{attendancePercentage}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">DPP Streak</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" /> {dppStreak} days
                </p>
              </div>
            </div>
            {/* Last 7 days indicator */}
            <div className="flex items-center gap-1 mt-2">
              {last7Days.slice().reverse().map((day, idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full ${day.present ? 'bg-primary' : 'bg-muted'}`}
                  title={day.date}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: DPT Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Daily Practice Test</h3>
            <Badge variant={todayCompleted ? 'secondary' : 'default'}>
              {todayCompleted ? 'Completed Today' : 'Pending Today'}
            </Badge>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {(weeklyData || defaultWeeklyData).map((d: any, idx: number) => (
              <div key={idx} className={`h-8 rounded-md flex items-center justify-center text-xs ${d.completed ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {d.completed ? (d.score ?? '✓') : d.day?.[0]}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">DPP Average</p>
              <p className="text-xl font-bold">{averageScore ?? 0}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Student ID</p>
              <p className="text-sm font-mono font-bold">{profile?.id?.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
