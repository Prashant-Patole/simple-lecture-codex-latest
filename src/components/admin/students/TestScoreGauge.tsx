import { Card, CardContent } from "@/components/ui/card";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

interface ActivityScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const TestScoreGauge = ({ 
  score, 
  size = "md", 
  showLabel = true 
}: ActivityScoreGaugeProps) => {
  const data = [{ value: score, fill: getScoreColor(score) }];
  
  const sizeMap = {
    sm: 120,
    md: 180,
    lg: 240,
  };

  function getScoreColor(score: number) {
    if (score >= 80) return "hsl(var(--chart-2))"; // Green
    if (score >= 60) return "hsl(var(--chart-3))"; // Yellow
    return "hsl(var(--destructive))"; // Red
  }

  function getScoreLabel(score: number) {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Needs Improvement";
  }

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={sizeMap[size]} height={sizeMap[size]}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background
            dataKey="value"
            cornerRadius={10}
            fill={data[0].fill}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground"
          >
            <tspan x="50%" dy="-0.5em" fontSize="32" fontWeight="bold">
              {score}
            </tspan>
            <tspan x="50%" dy="1.5em" fontSize="14" className="fill-muted-foreground">
              Test Score
            </tspan>
          </text>
        </RadialBarChart>
      </ResponsiveContainer>
      {showLabel && (
        <div className="mt-2 text-center">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
            score >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {getScoreLabel(score)}
          </span>
        </div>
      )}
    </div>
  );
};
