import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare, Clock, TrendingUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const AIActivityTab = ({ student }: { student: any }) => {
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const aiActivity = student.aiActivity || {};

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Queries</p>
                <p className="text-3xl font-bold">{aiActivity.total_queries}</p>
              </div>
              <Brain className="h-10 w-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-3xl font-bold">{aiActivity.avg_response_time}s</p>
              </div>
              <Clock className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engagement Score</p>
                <p className="text-3xl font-bold">{aiActivity.engagement_score}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Patterns */}
      {aiActivity.usage_pattern && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Queries by Hour of Day</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={aiActivity.usage_pattern.by_hour.map((count: number, hour: number) => ({
                    hour: `${hour}:00`,
                    count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topics Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(aiActivity.usage_pattern.by_topic).map(
                      ([topic, count]) => ({
                        name: topic,
                        value: count,
                      })
                    )}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {Object.keys(aiActivity.usage_pattern.by_topic).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conversation History */}
      {aiActivity.conversations && (
        <Card>
          <CardHeader>
            <CardTitle>Conversation History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiActivity.conversations.map((conv: any) => (
              <Collapsible
                key={conv.id}
                open={expandedConv === conv.id}
                onOpenChange={(isOpen) => setExpandedConv(isOpen ? conv.id : null)}
              >
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{conv.topic}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(conv.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {expandedConv === conv.id ? "Hide" : "View"}
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <div className="flex gap-2">
                    <Badge variant="outline">{conv.duration}s</Badge>
                    <Badge variant="outline">{conv.follow_up_count} follow-ups</Badge>
                    {conv.satisfaction && (
                      <Badge>⭐ {conv.satisfaction}/5</Badge>
                    )}
                  </div>

                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="space-y-2">
                      <div className="bg-muted/50 p-3 rounded">
                        <p className="text-sm font-medium mb-1">Question:</p>
                        <p className="text-sm">{conv.question}</p>
                      </div>
                      <div className="bg-primary/5 p-3 rounded">
                        <p className="text-sm font-medium mb-1">Answer:</p>
                        <p className="text-sm">{conv.answer}</p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
