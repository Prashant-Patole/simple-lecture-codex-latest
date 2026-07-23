import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Trophy, TrendingUp, Target, FileText, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMyTests } from "@/hooks/useMyTests";
import { format } from "date-fns";

interface MyTestsTabProps {
  student: any;
}

export const MyTestsTab = ({ student }: MyTestsTabProps) => {
  const { allTests, dppStats, paperStats, totalTests, averageScore, isLoading } = useMyTests();

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (totalTests === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Test Data Yet</h3>
            <p className="text-muted-foreground mb-4">
              Complete tests and practice DPPs to see your performance analytics here.
            </p>
            <Link to="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Performance chart data
  const performanceData = [
    { 
      name: 'DPP', 
      tests: dppStats.total, 
      avgScore: dppStats.avgScore,
      correct: dppStats.totalCorrect,
      total: dppStats.totalQuestions,
    },
    { 
      name: 'Papers', 
      tests: paperStats.total, 
      avgScore: paperStats.avgScore,
      correct: paperStats.totalCorrect,
      total: paperStats.totalQuestions,
    },
  ];

  // Pie chart data for test distribution
  const pieData = [
    { name: 'DPP Tests', value: dppStats.total },
    { name: 'Paper Tests', value: paperStats.total },
  ].filter(d => d.value > 0);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Test Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTests}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dppStats.total} DPPs • {paperStats.total} Papers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageScore}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all test types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dppStats.totalCorrect + paperStats.totalCorrect}/{dppStats.totalQuestions + paperStats.totalQuestions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Correct answers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Performance by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'avgScore' ? `${value}%` : value,
                    name === 'avgScore' ? 'Avg Score' : 'Tests'
                  ]}
                />
                <Bar dataKey="avgScore" fill="hsl(var(--chart-1))" name="Avg Score" />
                <Bar dataKey="tests" fill="hsl(var(--chart-2))" name="Tests" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Test Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allTests.slice(0, 10).map((test) => (
              <div key={test.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${test.type === 'dpp' ? 'bg-primary/10 dark:bg-primary' : 'bg-primary/10 dark:bg-primary'}`}>
                    {test.type === 'dpp' ? (
                      <Target className="h-4 w-4 text-primary dark:text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary dark:text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {test.type === 'dpp' ? 'Daily Practice' : 'Paper Test'}
                      {test.category && <span className="text-muted-foreground ml-1">({test.category})</span>}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(test.date), 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(test.time_taken_seconds)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <Badge variant={test.percentage >= 70 ? "default" : test.percentage >= 40 ? "secondary" : "destructive"}>
                      {test.percentage}%
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                      <CheckCircle2 className="h-3 w-3" />
                      {test.score}/{test.total_questions}
                    </p>
                  </div>
                  {test.result_id && (
                    <Link to={`/practice-results/${test.result_id}`}>
                      <Button variant="outline" size="sm">Review</Button>
                    </Link>
                  )}
                </div>

              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
