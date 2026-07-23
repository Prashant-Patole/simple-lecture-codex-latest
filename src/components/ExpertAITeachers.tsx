import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Dynamic imports for lazy loading - paths resolved by Vite at build time
const aiTeacher1 = new URL("@/assets/ai-teacher-1.png", import.meta.url).href;
const aiTeacher2 = new URL("@/assets/ai-teacher-2.png", import.meta.url).href;
const aiTeacher3 = new URL("@/assets/ai-teacher-3.png", import.meta.url).href;

const teachers = [
  {
    name: "Arjun Sharma",
    specialization: "All Subjects",
    bio: "Expert in breaking down complex problems into simple steps. Specializes in board exam preparation for Class 10 and PUC with a focus on conceptual clarity.",
    image: aiTeacher1,
  },
  {
    name: "Vikram Patel",
    specialization: "All Subjects",
    bio: "Master of NEET and JEE preparation. Known for making abstract concepts tangible through real-world examples and visual explanations.",
    image: aiTeacher2,
  },
  {
    name: "Rohit Mehta",
    specialization: "All Subjects",
    bio: "Versatile AI educator covering every subject from Social Science to Biology. Provides personalized learning paths and 24/7 doubt resolution.",
    image: aiTeacher3,
  },
];

export const ExpertAITeachers = () => {
  return (
    <section className="py-8 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6 md:mb-12">
          <Badge className="mb-4">AI-Powered Teaching</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Our Expert <span className="text-primary">AI Teachers</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Meet our AI teachers who are available 24/7 to help you master every subject
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {teachers.map((teacher) => (
            <Card
              key={teacher.name}
              className="group hover:shadow-hover transition-all duration-300 overflow-hidden text-center"
            >
              <div className="h-64 overflow-hidden">
                <img
                  src={teacher.image}
                  alt={teacher.name}
                  width={400}
                  height={256}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <CardContent className="pt-6 pb-8">
                
                <Badge variant="secondary" className="mb-4">
                  {teacher.specialization}
                </Badge>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {teacher.bio}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
