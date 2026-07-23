import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeachers } from "@/hooks/useTeachers";
import { useRef } from "react";

const InstructorsList = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { teachers, isLoading } = useTeachers();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Instructors</h2>
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex-shrink-0 w-[300px] p-4">
              <div className="flex flex-col items-center">
                <Skeleton className="h-20 w-20 rounded-full mb-3" />
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">My Instructors</h2>
        {teachers.length > 3 && (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => scroll('left')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => scroll('right')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      {teachers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No instructors assigned yet</p>
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {teachers.map((instructor) => (
            <Card 
              key={instructor.id} 
              className="flex-shrink-0 w-[300px] p-4 snap-start hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 mb-3">
                  <AvatarImage src={instructor.avatar_url || undefined} alt={instructor.full_name} />
                  <AvatarFallback>
                    {instructor.full_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-lg mb-1">{instructor.full_name}</h3>
                <div className="flex flex-wrap justify-center gap-1 mb-2">
                  {instructor.subjects?.slice(0, 2).map((subject, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {subject}
                    </Badge>
                  ))}
                </div>
                {instructor.specialization && (
                  <p className="text-xs text-muted-foreground mb-1">{instructor.specialization}</p>
                )}
                {instructor.bio && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{instructor.bio}</p>
                )}
                {instructor.email && (
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <a href={`mailto:${instructor.email}`}>
                      <MessageCircle className="h-3 w-3 mr-2" />
                      Contact
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};

export default InstructorsList;
