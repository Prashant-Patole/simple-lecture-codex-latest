import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, BarChart3, Trash2, DollarSign, ShoppingCart, Image, Loader2, BookOpen, FolderTree, Users, GraduationCap, Eye } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats";

const formatCurrency = (amount: number) => {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminDashboardStats();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const quickActions = [
    { icon: MessageSquare, label: "Comments", variant: "outline" as const },
    { icon: Mail, label: "Tickets", variant: "outline" as const },
    { icon: BarChart3, label: "Reports", variant: "outline" as const },
    { icon: Trash2, label: "Clear Cache", variant: "outline" as const },
  ];

  const handleMigrateThumbnails = async () => {
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in to run migration"); return; }
      const response = await supabase.functions.invoke("migrate-course-thumbnails", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      const result = response.data;
      setMigrationResult({ success: result.success, skipped: result.skipped, failed: result.failed });
      if (result.success > 0) toast.success(`Migrated ${result.success} thumbnails successfully!`);
      else if (result.skipped > 0) toast.info(`All ${result.skipped} thumbnails were already migrated or skipped.`);
      else toast.warning("No thumbnails to migrate.");
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Failed to migrate thumbnails. Check console for details.");
    } finally {
      setIsMigrating(false);
    }
  };

  const summaryCards = [
    { icon: BookOpen, label: "Total Courses", value: stats?.totalCourses ?? 0, color: "text-blue-600" },
    { icon: FolderTree, label: "Total Subjects", value: stats?.totalSubjects ?? 0, color: "text-emerald-600" },
    { icon: GraduationCap, label: "Active Enrollments", value: stats?.activeEnrollments ?? 0, color: "text-violet-600" },
    { icon: Users, label: "Total Users", value: stats?.totalUsers ?? 0, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div
        className="relative h-80 bg-cover bg-center rounded-lg overflow-hidden mx-6 mt-6"
        style={{
          backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-start justify-center px-12 text-white">
          <h1 className="text-4xl font-bold mb-4">Welcome, Admin!</h1>
          <p className="text-lg mb-8 max-w-2xl">
            Everything is in your control, use quick access buttons to manage related actions easily.
          </p>
          <div className="flex flex-wrap gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.label} variant={action.variant} className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20">
                  <Icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-lg bg-muted flex items-center justify-center ${card.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className="text-3xl font-bold">
                        {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : card.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Platform Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                {[
                  { label: "Today", value: stats?.todayIncome },
                  { label: "Month", value: stats?.monthIncome },
                  { label: "Year", value: stats?.yearIncome },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-2xl font-bold">
                      {statsLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : formatCurrency(item.value ?? 0)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales Count</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                {[
                  { label: "Today", value: stats?.todaySales },
                  { label: "Month", value: stats?.monthSales },
                  { label: "Year", value: stats?.yearSales },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-2xl font-bold">
                      {statsLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (item.value ?? 0)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg bg-primary flex items-center justify-center">
                  <DollarSign className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="text-3xl font-bold">
                    {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(stats?.totalIncome ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="h-14 w-14 rounded-lg bg-primary flex items-center justify-center">
                  <ShoppingCart className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-3xl font-bold">
                    {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (stats?.totalSales ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visitor Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" /> Visitor Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              {[
                { label: "Today", value: stats?.todayVisitors },
                { label: "Month", value: stats?.monthVisitors },
                { label: "Year", value: stats?.yearVisitors },
                { label: "Total", value: stats?.totalVisitors },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-2xl font-bold">
                    {statsLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (item.value ?? 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Thumbnail Migration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Migrate Course Thumbnails
            </CardTitle>
            <CardDescription>
              Migrate existing base64 thumbnails to the storage bucket for better performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleMigrateThumbnails} disabled={isMigrating} className="w-full sm:w-auto">
              {isMigrating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Migrating...</>) : (<><Image className="mr-2 h-4 w-4" />Migrate Thumbnails</>)}
            </Button>
            {migrationResult && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{migrationResult.success}</div>
                  <div className="text-sm text-muted-foreground">Migrated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{migrationResult.skipped}</div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{migrationResult.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
