import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { ManualEnrollDialog } from "@/components/admin/students/ManualEnrollDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { StudentFilters } from "@/components/admin/students/StudentFilters";
import { StudentStatsCards } from "@/components/admin/students/StudentStatsCards";
import { StudentListTable } from "@/components/admin/students/StudentListTable";
import { StudentDetailView } from "@/components/admin/students/StudentDetailView";
import { useStudents } from "@/hooks/useStudents";
import { useStudentDetails } from "@/hooks/useStudentDetails";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// Hook to fetch registered-but-not-enrolled users
const useUnenrolledUsers = () => {
  return useQuery({
    queryKey: ["unenrolled-users"],
    queryFn: async () => {
      // Get all profile IDs
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get all enrolled student IDs
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("is_active", true);

      if (enrollError) throw enrollError;

      const enrolledIds = new Set(enrollments?.map((e) => e.student_id) || []);

      // Get emails from auth (via payments table as proxy - profiles don't have email)
      const { data: payments } = await supabase
        .from("payments")
        .select("user_id, status, created_at")
        .order("created_at", { ascending: false });

      const paymentsByUser = new Map<string, { status: string; created_at: string }>();
      payments?.forEach((p) => {
        if (!paymentsByUser.has(p.user_id)) {
          paymentsByUser.set(p.user_id, { status: p.status, created_at: p.created_at });
        }
      });

      // Filter to unenrolled users
      const unenrolled = (profiles || [])
        .filter((p) => !enrolledIds.has(p.id))
        .map((p) => ({
          id: p.id,
          full_name: p.full_name || "Unknown",
          phone_number: p.phone_number || "",
          registered_at: p.created_at,
          last_payment_status: paymentsByUser.get(p.id)?.status || null,
          last_payment_date: paymentsByUser.get(p.id)?.created_at || null,
        }));

      return unenrolled;
    },
  });
};

export default function UsersList() {
  const [filters, setFilters] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("enrolled");
  const [enrollDialogUser, setEnrollDialogUser] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useStudents({ ...filters, page: currentPage, limit: 20 });
  const { data: studentDetails, isLoading: isLoadingDetails } = useStudentDetails(
    selectedStudentId || ""
  );
  const { data: unenrolledUsers, isLoading: unenrolledLoading } = useUnenrolledUsers();

  if (selectedStudentId && studentDetails && !isLoadingDetails) {
    return (
      <div className="p-8">
        <StudentDetailView
          student={studentDetails}
          onClose={() => setSelectedStudentId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Management</h1>
          <p className="text-muted-foreground">
            Comprehensive view of all students with advanced analytics
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </div>

      <StudentStatsCards />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="enrolled">
            Enrolled Students
            {data?.total ? <Badge variant="secondary" className="ml-2">{data.total}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="unenrolled">
            Registered (Not Enrolled)
            {unenrolledUsers ? <Badge variant="destructive" className="ml-2">{unenrolledUsers.length}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrolled">
          <Card className="p-6 space-y-6">
            <StudentFilters onFilterChange={setFilters} />

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <>
                <StudentListTable
                  students={data?.students || []}
                  onStudentClick={setSelectedStudentId}
                />

                {data && data.totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {[...Array(data.totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink
                            onClick={() => setCurrentPage(i + 1)}
                            isActive={currentPage === i + 1}
                            className="cursor-pointer"
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(data.totalPages, currentPage + 1))}
                          className={currentPage === data.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}

                <p className="text-sm text-muted-foreground text-center">
                  Showing {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, data?.total || 0)} of {data?.total || 0} students
                </p>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="unenrolled">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Users who registered but have no active enrollment</h3>
              <p className="text-sm text-muted-foreground">These users may have dropped off during payment or never purchased a course.</p>
            </div>

            {unenrolledLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unenrolledUsers?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        All registered users have active enrollments! 🎉
                      </TableCell>
                    </TableRow>
                  )}
                  {unenrolledUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.phone_number || "—"}</TableCell>
                      <TableCell>{format(new Date(user.registered_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        {user.last_payment_date
                          ? format(new Date(user.last_payment_date), "dd MMM yyyy")
                          : "No payment"}
                      </TableCell>
                      <TableCell>
                        {user.last_payment_status === "pending" ? (
                          <Badge variant="destructive">Payment Pending</Badge>
                        ) : user.last_payment_status === "success" ? (
                          <Badge variant="secondary">Paid (No Enrollment)</Badge>
                        ) : (
                          <Badge variant="outline">No Purchase</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEnrollDialogUser({ id: user.id, name: user.full_name })}
                        >
                          <UserPlus className="mr-1 h-3 w-3" />
                          Enroll
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {enrollDialogUser && (
        <ManualEnrollDialog
          open={!!enrollDialogUser}
          onOpenChange={(open) => !open && setEnrollDialogUser(null)}
          userId={enrollDialogUser.id}
          userName={enrollDialogUser.name}
        />
      )}
    </div>
  );
}
