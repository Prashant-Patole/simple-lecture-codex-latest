import { Shield, Users, Star, Building2 } from "lucide-react";

const badges = [
  { icon: Star, label: "4.9★ Rating" },
  { icon: Users, label: "1,00,000+ Students" },
  { icon: Shield, label: "AI-Powered Platform" },
  { icon: Building2, label: "KRUPA KNOWLEDGE STORE PVT LTD" },
];

export const TrustCredibilitySection = () => {
  return (
    <section className="py-12 bg-muted/30 border-y">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-4">
          Backed by India's Top Educators
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-6">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div key={badge.label} className="flex items-center gap-2 px-4 py-2 bg-card rounded-full border shadow-sm text-sm font-medium">
                <Icon className="w-4 h-4 text-primary" />
                <span>{badge.label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Our AI tutors are trained on curriculum-aligned content reviewed by expert educators from across India. All learning material follows official board syllabi.
        </p>
      </div>
    </section>
  );
};
