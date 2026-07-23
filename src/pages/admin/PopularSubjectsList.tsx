import { useState, useDeferredValue, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Pencil, Trash2, Sparkles, Search, X } from "lucide-react";
import { useAdminPopularSubjectsPaginated } from "@/hooks/useAdminPopularSubjectsFiltered";
import { useDeleteSubject } from "@/hooks/useAdminPopularSubjects";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PopularSubjectsList() {
  const navigate = useNavigate();
  // Immediate state for responsive input
  const [searchInput, setSearchInput] = useState("");
  // Deferred value for API/filtering - prevents excessive re-renders
  const deferredSearch = useDeferredValue(searchInput);
  
  const [categoryId, setCategoryId] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Server-side pagination with O(n) transformation where n=pageSize
  const { data: paginatedData, isLoading } = useAdminPopularSubjectsPaginated({
    page: currentPage,
    pageSize,
    categoryId,
    courseId,
    searchTerm: deferredSearch,
  });

  const subjects = paginatedData?.data || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 0;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, categoryId, courseId]);
  const { data: categories } = useAdminCategories();
  const { data: courses } = useAdminCourses();
  const deleteSubject = useDeleteSubject();

  const resetFilters = () => {
    setSearchInput("");
    setCategoryId("all");
    setCourseId("all");
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteSubject.mutate(deleteId);
      setDeleteId(null);
    }
  };

  // Show loading indicator while search is being deferred
  const isSearchPending = searchInput !== deferredSearch;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Popular Subjects</h1>
          <p className="text-muted-foreground">Manage featured subjects</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/admin/subjects/add")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subject (Enhanced)
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/popular-subjects/add")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subject (Simple)
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>Search Subject</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`pl-9 ${isSearchPending ? 'opacity-70' : ''}`}
              />
            </div>
          </div>
          
          <div className="w-[200px]">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-[200px]">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" onClick={resetFilters}>
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Mapped Courses</TableHead>
              <TableHead>Display Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading subjects...
                </TableCell>
              </TableRow>
            ) : subjects?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No subjects found
                </TableCell>
              </TableRow>
            ) : (
              subjects?.map((subject: any) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell className="text-muted-foreground">{subject.slug}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{subject.category_name || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {subject.courses?.length > 0 ? (
                        subject.courses.map((course: any) => (
                          <Badge key={course.id} variant="secondary" className="text-xs">
                            {course.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">No courses</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{subject.display_order}</TableCell>
                  <TableCell>
                    <Badge variant={subject.is_active ? "default" : "secondary"}>
                      {subject.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/subjects/${subject.id}/edit`)}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Enhanced
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/admin/popular-subjects/edit/${subject.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(subject.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount} subjects
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={page === currentPage}
                    onClick={() => setCurrentPage(page)}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the subject.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
