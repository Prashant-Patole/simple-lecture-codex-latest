import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";
import { useSubjectsByCategory } from "@/hooks/useSubjectsByCategory";
import { useInstructorSubjects, useUpdateInstructorSubjects } from "@/hooks/useInstructors";
import { Badge } from "@/components/ui/badge";

interface InstructorSubjectMapperProps {
  instructorId: string;
}

export const InstructorSubjectMapper = ({ instructorId }: InstructorSubjectMapperProps) => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [mappedSubjects, setMappedSubjects] = useState<any[]>([]);

  const { data: categories } = useAdminCategories();
  const { data: subjects } = useSubjectsByCategory(selectedCategory);
  const { data: existingSubjects, refetch } = useInstructorSubjects(instructorId);
  const updateSubjects = useUpdateInstructorSubjects();


  useEffect(() => {
    if (existingSubjects) {
      setMappedSubjects(existingSubjects);
    }
  }, [existingSubjects]);

  const handleAddSubject = () => {
    if (!selectedCategory || !selectedSubject) return;

    const exists = mappedSubjects.some(
      (s) => s.category_id === selectedCategory && s.subject_id === selectedSubject
    );

    if (!exists) {
      const category = categories?.find((c) => c.id === selectedCategory);
      const subject = subjects?.find((s) => s.id === selectedSubject);

      setMappedSubjects([
        ...mappedSubjects,
        {
          category_id: selectedCategory,
          subject_id: selectedSubject,
          category: { id: selectedCategory, name: category?.name },
          subject: { id: selectedSubject, name: subject?.name },
        },
      ]);
    }

    setSelectedCategory("");
    setSelectedSubject("");
  };

  const handleRemoveSubject = (categoryId: string, subjectId: string) => {
    setMappedSubjects(
      mappedSubjects.filter(
        (s) => !(s.category_id === categoryId && s.subject_id === subjectId)
      )
    );
  };

  const handleSave = async () => {
    await updateSubjects.mutateAsync({
      instructorId,
      subjects: mappedSubjects,
    });
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject Mapping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <SearchableCategorySelector
            value={selectedCategory}
            onChange={(val) => {
              setSelectedCategory(val);
              setSelectedSubject(""); // Reset subject when category changes
            }}
            placeholder="Search category..."
          />

          <Select 
            value={selectedSubject} 
            onValueChange={setSelectedSubject}
            disabled={!selectedCategory}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedCategory ? "Select subject" : "Select category first"} />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {subjects?.map((subj) => (
                <SelectItem key={subj.id} value={subj.id}>
                  {subj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleAddSubject} disabled={!selectedCategory || !selectedSubject}>
            <Plus className="mr-2 h-4 w-4" />
            Add Subject
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Mapped Subjects</h4>
          <div className="flex flex-wrap gap-2">
            {mappedSubjects.map((item) => (
              <Badge key={`${item.category_id}-${item.subject_id}`} variant="secondary" className="gap-2">
                {item.category?.name} - {item.subject?.name}
                <button
                  onClick={() => handleRemoveSubject(item.category_id, item.subject_id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {mappedSubjects.length === 0 && (
              <p className="text-sm text-muted-foreground">No subjects mapped yet</p>
            )}
          </div>
        </div>

        <Button onClick={handleSave}>Save Subject Mapping</Button>
      </CardContent>
    </Card>
  );
};
