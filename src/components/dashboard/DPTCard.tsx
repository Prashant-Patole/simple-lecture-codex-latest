import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Target, TrendingUp, Calendar } from "lucide-react";
import { useDPT } from "@/hooks/useDPT";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

export const DPTCard = () => {
  const { streak, averageScore, completionRate, todayCompleted, totalTests, isLoading } = useDPT();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Daily Practice Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Daily Practice Test (DPT)
          </span>
          {todayCompleted ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Completed Today
            </Badge>
          ) : (
            <Badge variant="destructive">Pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
            <Flame className="h-6 w-6 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{streak}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </div>

          <div className="text-center p-3 rounded-lg bg-primary/10 dark:bg-primary/20">
            <TrendingUp className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-primary dark:text-primary">{averageScore}%</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>

          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
            <Calendar className="h-6 w-6 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalTests}</p>
            <p className="text-xs text-muted-foreground">Total Tests</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Monthly Completion</p>
            <p className="text-sm font-bold">{completionRate}%</p>
          </div>
          <Progress value={completionRate} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Complete daily tests to improve your streak
          </p>
        </div>

      </CardContent>
    </Card>
  );
};
