import { Shield, Users, Star, Award } from "lucide-react";

interface CourseTrustSectionProps {
  rating: number | null;
  studentCount: number | null;
}

export const CourseTrustSection = ({ rating, studentCount }: CourseTrustSectionProps) => {
  const badges = [
    ...(rating ? [{ icon: Star, label: `${rating}★ Rating` }] : []),
    ...(studentCount ? [{ icon: Users, label: `${studentCount.toLocaleString()}+ Students` }] : []),
    { icon: Shield, label: "AI-Powered" },
    { icon: Award, label: "30-Day Guarantee" },
  ];

  return (
    <section className="py-8 border-y bg-muted/30">
      <div className="text-center space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Backed by India's Top Educators
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.label}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-card rounded-full border shadow-sm text-xs font-medium"
              >
                <Icon className="w-3.5 h-3.5 text-primary" />
                <span>{badge.label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs max-w-lg mx-auto">
          Our AI tutors are trained on curriculum-aligned content reviewed by expert educators from across India. All learning material follows official board syllabi.
        </p>
      </div>
    </section>
  );
};
