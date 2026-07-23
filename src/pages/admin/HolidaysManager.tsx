import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export default function HolidaysManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [formData, setFormData] = useState({
    date: "",
    name: "",
    description: "",
    is_recurring: false,
  });

  // TODO: Re-enable after Supabase types are regenerated
  // const { data: holidays } = useHolidays();
  // const createHoliday = useCreateHoliday();
  // const updateHoliday = useUpdateHoliday();
  // const deleteHoliday = useDeleteHoliday();
  const holidays: any[] = [];

  const handleOpenDialog = (holiday?: any) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        date: holiday.date,
        name: holiday.name,
        description: holiday.description || "",
        is_recurring: holiday.is_recurring,
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        date: "",
        name: "",
        description: "",
        is_recurring: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // TODO: Re-enable after Supabase types are regenerated
    toast.info("Holiday management will be implemented after database types sync");
    console.log("Holiday data:", formData);

    setIsDialogOpen(false);
    setFormData({ date: "", name: "", description: "", is_recurring: false });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this holiday?")) {
      // TODO: Re-enable after Supabase types are regenerated
      toast.info("Holiday deletion will be implemented after database types sync");
      console.log("Delete holiday:", id);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Holidays Management</h1>
          <p className="text-muted-foreground">Manage academic holidays and special dates</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Holiday
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holidays List</CardTitle>
        </CardHeader>
        <CardContent>
          {holidays && holidays.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {format(new Date(holiday.date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {holiday.description || "-"}
                    </TableCell>
                    <TableCell>
                      {holiday.is_recurring ? (
                        <Badge variant="secondary">Recurring</Badge>
                      ) : (
                        <Badge variant="outline">One-time</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleOpenDialog(holiday)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDelete(holiday.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No holidays added yet. Click "Add Holiday" to create one.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Holiday Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Independence Day"
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={formData.is_recurring}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_recurring: checked as boolean })
                }
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Recurring annually (e.g., Independence Day every year)
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingHoliday ? "Update" : "Create"} Holiday
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
