import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Search, Filter } from "lucide-react";
import { useInstructorActivityLogs } from "@/hooks/useInstructorActivityLogs";
import { useLogInstructorActivity } from "@/hooks/useLogInstructorActivity";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const ACTION_TYPE_COLORS: Record<string, string> = {
  LOGIN: "bg-green-100 text-green-800",
  LOGOUT: "bg-gray-100 text-gray-800",
  MEETING_CREATED: "bg-blue-100 text-blue-800",
  MEETING_JOINED: "bg-purple-100 text-purple-800",
  MEETING_ENDED: "bg-red-100 text-red-800",
  VIEW_DASHBOARD: "bg-yellow-100 text-yellow-800",
  VIEW_CLASSES: "bg-indigo-100 text-indigo-800",
  VIEW_SUBJECTS: "bg-pink-100 text-pink-800",
  VIEW_SUBJECT: "bg-orange-100 text-orange-800",
};

export default function InstructorActivityLog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const { data: logs, isLoading } = useInstructorActivityLogs(200);
  const logActivity = useLogInstructorActivity();

  useEffect(() => {
    logActivity.mutate({
      action: "Viewed activity log",
      action_type: "VIEW_ACTIVITY_LOG",
      metadata: {}
    });
  }, []);

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || log.action_type === filterType;
    return matchesSearch && matchesType;
  });

  const uniqueActionTypes = [...new Set(logs?.map(log => log.action_type) || [])];

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground">View your activity history.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueActionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Recent Activity ({filteredLogs?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Date & Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={ACTION_TYPE_COLORS[log.action_type] || "bg-gray-100 text-gray-800"}
                      >
                        {log.action_type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {JSON.stringify(log.metadata).substring(0, 50)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(log.created_at), "PPP 'at' h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
