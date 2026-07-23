import { Badge } from "@/components/ui/badge";

interface DifficultyBadgeProps {
  level: 'Low' | 'Medium' | 'Intermediate' | 'Advanced';
  className?: string;
}

export const DifficultyBadge = ({ level, className }: DifficultyBadgeProps) => {
  const variants = {
    Low: "bg-green-100 text-green-800 border-green-200",
    Medium: "bg-blue-100 text-blue-800 border-blue-200",
    Intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Advanced: "bg-red-100 text-red-800 border-red-200"
  };

  return (
    <Badge variant="outline" className={`${variants[level]} ${className}`}>
      {level}
    </Badge>
  );
};
