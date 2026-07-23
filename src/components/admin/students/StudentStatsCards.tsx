import { Users, UserCheck, AlertTriangle, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStudentStats } from "@/hooks/useStudents";
import { Skeleton } from "@/components/ui/skeleton";

export const StudentStatsCards = () => {
  const { data: stats, isLoading } = useStudentStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statItems = [
    { label: "Total Students", value: stats?.total || 0, icon: Users, color: "text-blue-500" },
    { label: "Active", value: stats?.active || 0, icon: UserCheck, color: "text-green-500" },
    { label: "At Risk", value: stats?.atRisk || 0, icon: AlertTriangle, color: "text-orange-500" },
    { label: "New (30 days)", value: stats?.newStudents || 0, icon: UserPlus, color: "text-purple-500" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`h-10 w-10 ${stat.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
