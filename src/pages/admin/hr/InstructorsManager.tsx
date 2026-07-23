import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, UserPlus, Key, Copy, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInstructors, useCreateInstructor, useUpdateInstructor, useInstructor } from "@/hooks/useInstructors";
import { useResetInstructorPassword } from "@/hooks/useResetInstructorPassword";
import { DepartmentSelector } from "@/components/hr/DepartmentSelector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InstructorSubjectMapper } from "@/components/hr/InstructorSubjectMapper";
import { ImageUploadWidget } from "@/components/admin/ImageUploadWidget";
import { AIImageGenerator } from "@/components/admin/AIImageGenerator";
import { AddTimeSlotDialog } from "@/components/hr/AddTimeSlotDialog";
import { InstructorTimetableView } from "@/components/hr/InstructorTimetableView";
import { useInstructorTimetable } from "@/hooks/useInstructorTimetable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function InstructorsManager() {
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showTimeSlotDialog, setShowTimeSlotDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    employee_id: "",
    date_of_joining: "",
    department_id: "",
    qualification: "",
    experience_years: "",
    bio: "",
    avatar_url: "",
    password: "",
    confirmPassword: "",
  });

  const { data: instructors, isLoading } = useInstructors();
  const { data: selectedInstructor } = useInstructor(selectedInstructorId || "");
  const createInstructor = useCreateInstructor();
  const updateInstructor = useUpdateInstructor();
  const resetPassword = useResetInstructorPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password for new instructors
    if (!selectedInstructorId && !editMode) {
      // This shouldn't happen, but just in case
    }
    
    if (!selectedInstructorId && formData.password) {
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
    }
    
    const data = {
      full_name: formData.full_name,
      email: formData.email,
      phone_number: formData.phone_number,
      employee_id: formData.employee_id,
      date_of_joining: formData.date_of_joining,
      department_id: formData.department_id || null,
      qualification: formData.qualification,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      bio: formData.bio,
      avatar_url: formData.avatar_url,
      password: formData.password || undefined, // Include password for new instructor
    };

    if (selectedInstructorId && editMode) {
      const { password, ...updateData } = data;
      await updateInstructor.mutateAsync({ id: selectedInstructorId, data: updateData });
    } else {
      const result = await createInstructor.mutateAsync(data);
      if (result) {
        setSelectedInstructorId(result.id);
        // Show credentials dialog with email and password
        if (formData.password) {
          setCreatedCredentials({ email: formData.email, password: formData.password });
          setShowCredentialsDialog(true);
        }
      }
    }
    
    setEditMode(false);
  };

  const handleResetPassword = async () => {
    if (!selectedInstructorId) return;
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    await resetPassword.mutateAsync({ instructorId: selectedInstructorId, newPassword });
    setShowResetPasswordDialog(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const copyCredentials = () => {
    if (createdCredentials) {
      navigator.clipboard.writeText(
        `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLogin URL: ${window.location.origin}/auth`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Credentials copied to clipboard");
    }
  };

  const handleEdit = (inst: any) => {
    setSelectedInstructorId(inst.id);
    setFormData({
      full_name: inst.full_name || "",
      email: inst.email || "",
      phone_number: inst.phone_number || "",
      employee_id: inst.employee_id || "",
      date_of_joining: inst.date_of_joining || "",
      department_id: inst.department_id || "",
      qualification: inst.qualification || "",
      experience_years: inst.experience_years?.toString() || "",
      bio: inst.bio || "",
      avatar_url: inst.avatar_url || "",
      password: "",
      confirmPassword: "",
    });
    setEditMode(true);
  };

  const handleCreateNew = () => {
    setSelectedInstructorId(null);
    setEditMode(true);
    setFormData({
      full_name: "",
      email: "",
      phone_number: "",
      employee_id: "",
      date_of_joining: "",
      department_id: "",
      qualification: "",
      experience_years: "",
      bio: "",
      avatar_url: "",
      password: "",
      confirmPassword: "",
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instructors</h1>
          <p className="text-muted-foreground">Manage instructor profiles and assignments</p>
        </div>
        <Button onClick={handleCreateNew}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Instructor
        </Button>
      </div>

      <Tabs defaultValue="list" value={editMode || selectedInstructorId ? "form" : "list"}>
        <TabsList>
          <TabsTrigger value="list" onClick={() => { setEditMode(false); setSelectedInstructorId(null); }}>
            Instructors List
          </TabsTrigger>
          {(editMode || selectedInstructorId) && (
            <TabsTrigger value="form">
              {editMode ? (selectedInstructorId ? "Edit" : "Add") : "View"} Instructor
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Instructors</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Loading...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instructor</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Subjects</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instructors?.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={inst.avatar_url || undefined} />
                              <AvatarFallback>{inst.full_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{inst.full_name}</p>
                              <p className="text-sm text-muted-foreground">{inst.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{inst.employee_id || "-"}</TableCell>
                        <TableCell>{inst.department?.name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {inst.subjects?.slice(0, 2).map((s: any) => (
                              <Badge key={s.id} variant="secondary" className="text-xs">
                                {s.subject?.name}
                              </Badge>
                            ))}
                            {inst.subjects && inst.subjects.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{inst.subjects.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(inst)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form">
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic">Basic Details</TabsTrigger>
              {selectedInstructorId && (
                <>
                  <TabsTrigger value="subjects">Subject Mapping</TabsTrigger>
                  <TabsTrigger value="timetable">Timetable</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="full_name">Full Name *</Label>
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          required
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone_number">Phone Number</Label>
                        <Input
                          id="phone_number"
                          value={formData.phone_number}
                          onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="employee_id">Employee ID</Label>
                        <Input
                          id="employee_id"
                          value={formData.employee_id}
                          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="date_of_joining">Date of Joining</Label>
                        <Input
                          id="date_of_joining"
                          type="date"
                          value={formData.date_of_joining}
                          onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                          disabled={!editMode}
                        />
                      </div>
                      <div>
                        <Label htmlFor="experience_years">Experience (Years)</Label>
                        <Input
                          id="experience_years"
                          type="number"
                          value={formData.experience_years}
                          onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                          disabled={!editMode}
                        />
                      </div>
                    </div>
                    
                    <DepartmentSelector
                      value={formData.department_id}
                      onChange={(value) => setFormData({ ...formData, department_id: value })}
                    />

                    <div>
                      <Label htmlFor="avatar_url">Instructor Photo</Label>
                      <ImageUploadWidget
                        label=""
                        value={formData.avatar_url}
                        onChange={(url) => setFormData({ ...formData, avatar_url: url })}
                        onFileSelect={async (file) => { return ""; }}
                      />
                    </div>

                    {editMode && (
                      <>
                        <AIImageGenerator
                          suggestedPrompt={`Professional instructor photo for ${formData.full_name || 'teacher'}. Modern classroom setting, professional photography style, warm lighting.`}
                          onImageGenerated={(url) => setFormData({ ...formData, avatar_url: url })}
                        />
                      </>
                    )}

                    <div>
                      <Label htmlFor="qualification">Qualification</Label>
                      <Input
                        id="qualification"
                        value={formData.qualification}
                        onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                        disabled={!editMode}
                      />
                    </div>

                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        disabled={!editMode}
                      />
                    </div>

                    {/* Password fields - only for new instructor creation */}
                    {editMode && !selectedInstructorId && (
                      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                        <div>
                          <Label htmlFor="password">Password *</Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Min 6 characters"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="confirmPassword">Confirm Password *</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            placeholder="Re-enter password"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {editMode && (
                      <div className="flex gap-2">
                        <Button type="submit">
                          {selectedInstructorId ? "Update" : "Create"} Instructor
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEditMode(false)}>
                          Cancel
                        </Button>
                        {selectedInstructorId && (
                          <Button type="button" variant="secondary" onClick={() => setShowResetPasswordDialog(true)}>
                            <Key className="mr-2 h-4 w-4" />
                            Change Password
                          </Button>
                        )}
                      </div>
                    )}
                    {!editMode && selectedInstructorId && (
                      <div className="flex gap-2">
                        <Button type="button" onClick={() => setEditMode(true)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Details
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowResetPasswordDialog(true)}>
                          <Key className="mr-2 h-4 w-4" />
                          Reset Password
                        </Button>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {selectedInstructorId && (
              <>
                <TabsContent value="subjects">
                  <InstructorSubjectMapper instructorId={selectedInstructorId} />
                </TabsContent>
                <TabsContent value="timetable">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Instructor Timetable</CardTitle>
                        <Button onClick={() => setShowTimeSlotDialog(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Time Slot
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <InstructorTimetableView instructorId={selectedInstructorId} />
                    </CardContent>
                  </Card>
                  <AddTimeSlotDialog
                    open={showTimeSlotDialog}
                    onOpenChange={setShowTimeSlotDialog}
                    instructorId={selectedInstructorId}
                  />
                </TabsContent>
              </>
            )}
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Instructor Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <Label htmlFor="confirmNewPassword">Confirm Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog - shown after creating new instructor */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instructor Created Successfully</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Share these credentials with the instructor to allow them to login:
            </p>
            <div className="p-4 bg-muted rounded-lg space-y-2 font-mono text-sm">
              <p><strong>Email:</strong> {createdCredentials?.email}</p>
              <p><strong>Password:</strong> {createdCredentials?.password}</p>
              <p><strong>Login URL:</strong> {window.location.origin}/auth</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredentialsDialog(false)}>
              Close
            </Button>
            <Button onClick={copyCredentials}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied!" : "Copy Credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
