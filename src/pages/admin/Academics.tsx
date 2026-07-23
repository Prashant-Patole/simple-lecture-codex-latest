import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, BookOpen, FileText, ClipboardList, CalendarOff } from "lucide-react";

export default function Academics() {
  const navigate = useNavigate();
  
  const sections = [
    {
      title: "Timetable",
      icon: Calendar,
      description: "Manage course-based timetables and schedules",
      path: "/admin/academics/timetable",
    },
    {
      title: "Holidays",
      icon: CalendarOff,
      description: "Mark and manage academic holidays",
      path: "/admin/academics/holidays",
    },
    {
      title: "Curriculum",
      icon: BookOpen,
      description: "Organize course curriculum and syllabus",
      path: "/admin/academics/curriculum",
    },
    {
      title: "Assignments",
      icon: FileText,
      description: "Create and manage student assignments",
      path: "/admin/assignments",
    },
    {
      title: "Assessments",
      icon: ClipboardList,
      description: "Set up tests and evaluations",
      path: "/admin/academics/assessments",
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manage Academics</h1>
        <p className="text-muted-foreground">Academic management tools and resources</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card 
              key={section.title} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => section.path && navigate(section.path)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{section.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
