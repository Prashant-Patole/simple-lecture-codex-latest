import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFollowups } from "@/hooks/useFollowups";
import { format } from "date-fns";

export const FollowupsTab = ({ student }: { student: any }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { createFollowup, isCreating, updateFollowupStatus } = useFollowups(student.id);

  const [formData, setFormData] = useState({
    followup_type: "general",
    message: "",
    priority: "medium",
    scheduled_for: "",
  });

  const handleSubmit = () => {
    createFollowup({
      student_id: student.id,
      ...formData,
    } as any);
    setIsDialogOpen(false);
    setFormData({
      followup_type: "general",
      message: "",
      priority: "medium",
      scheduled_for: "",
    });
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      low: "secondary",
      medium: "default",
      high: "destructive",
    };
    return <Badge variant={variants[priority]}>{priority}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      test_reminder: "Test Reminder",
      live_class_reminder: "Live Class",
      ai_tutorial_prompt: "AI Tutorial",
      general: "General",
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  const pendingFollowups = student.followups?.filter((f: any) => f.status === "pending") || [];
  const completedFollowups = student.followups?.filter((f: any) => f.status === "completed") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Follow-up Management</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Follow-up
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Follow-up</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.followup_type}
                  onValueChange={(v) => setFormData({ ...formData, followup_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test_reminder">Test Reminder</SelectItem>
                    <SelectItem value="live_class_reminder">Live Class Reminder</SelectItem>
                    <SelectItem value="ai_tutorial_prompt">AI Tutorial Prompt</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Enter follow-up message..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Schedule For</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_for}
                  onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })}
                />
              </div>

              <Button onClick={handleSubmit} disabled={isCreating} className="w-full">
                Create Follow-up
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Follow-ups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Pending Follow-ups ({pendingFollowups.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingFollowups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending follow-ups</p>
          ) : (
            pendingFollowups.map((followup: any) => (
              <div key={followup.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(followup.type)}
                      {getPriorityBadge(followup.priority)}
                    </div>
                    <p className="text-sm font-medium">{followup.message}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Scheduled for{" "}
                        {format(new Date(followup.scheduled_for), "MMM dd, yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateFollowupStatus({ id: followup.id, status: "completed" })
                    }
                  >
                    Mark Complete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Completed Follow-ups */}
      {completedFollowups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedFollowups.map((followup: any) => (
              <div key={followup.id} className="border rounded-lg p-4 opacity-60 space-y-2">
                <div className="flex items-center gap-2">
                  {getTypeBadge(followup.type)}
                  {getPriorityBadge(followup.priority)}
                  <Badge variant="default">Completed</Badge>
                </div>
                <p className="text-sm">{followup.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
