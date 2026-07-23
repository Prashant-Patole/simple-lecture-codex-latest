import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Bot, BookOpen, ClipboardList, Video, FileText, GraduationCap, Sparkles } from 'lucide-react';
import type { SubjectWithDetails } from '@/hooks/useDashboardCourseDetails';

interface CourseSubjectCardProps {
  subject: SubjectWithDetails;
  courseId: string;
}

export const CourseSubjectCard = ({ subject, courseId }: CourseSubjectCardProps) => {
  const navigate = useNavigate();
  
  const { contentProgress, overallPercentage } = subject;

  const handleAskAI = () => {
    navigate(`/learning/${courseId}?subject=${subject.id}&tab=ai-assistant`);
  };

  const handleViewSubject = () => {
    navigate(`/learning/${courseId}?subject=${subject.id}`);
  };

  const handleImportantQuestions = () => {
    navigate(`/learning/${courseId}?subject=${subject.id}&tab=pyqs`);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30 bg-card">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              {subject.thumbnail_url ? (
                <img 
                  src={subject.thumbnail_url} 
                  alt={subject.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <BookOpen className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {subject.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {subject.chaptersTotal} chapters
              </p>
            </div>
          </div>
          
          {subject.pendingAssignments > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <ClipboardList className="h-3 w-3" />
              {subject.pendingAssignments}
            </Badge>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">{overallPercentage}%</span>
          </div>
          <Progress value={overallPercentage} className="h-2" />
          
          {/* Content Breakdown */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            {contentProgress.lectures.total > 0 && (
              <span className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                Lectures: {contentProgress.lectures.watched}/{contentProgress.lectures.total}
              </span>
            )}
            {contentProgress.dpp.total > 0 && (
              <span className="flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                DPP: {contentProgress.dpp.solved}/{contentProgress.dpp.total}
              </span>
            )}
            {contentProgress.pyq.total > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                PYQ: {contentProgress.pyq.solved}/{contentProgress.pyq.total}
              </span>
            )}
            {contentProgress.proficiency.total > 0 && (
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                Proficiency: {contentProgress.proficiency.solved}/{contentProgress.proficiency.total}
              </span>
            )}
            {contentProgress.tests.total > 0 && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Tests: {contentProgress.tests.solved}/{contentProgress.tests.total}
              </span>
            )}
          </div>
        </div>

        {/* PYQ / Model Paper Highlight */}
        <div className="mb-3 p-2.5 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Up to 80% questions from Model Papers!</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0 text-[10px] px-1.5 py-0">Predicted</Badge>
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 text-[10px] px-1.5 py-0">Important</Badge>
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-0 text-[10px] px-1.5 py-0">PYQ</Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleViewSubject}
          >
            <BookOpen className="h-4 w-4 mr-1" />
            Study
          </Button>
          <Button 
            size="sm" 
            className="flex-1 bg-gradient-to-r from-primary to-primary/80"
            onClick={handleAskAI}
          >
            <Bot className="h-4 w-4 mr-1" />
            Ask AI Teacher
          </Button>
        </div>
          <Button 
            size="sm" 
            className="w-full mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 animate-pulse"
            onClick={handleImportantQuestions}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            ⭐ Important & Predicted Questions
          </Button>
      </CardContent>
    </Card>
  );
};
