import { Card } from '@/components/ui/card';
import { Trophy, AlertTriangle, TrendingUp, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PerformanceTier = 'weak' | 'average' | 'good';

export const getTier = (percentage: number): PerformanceTier => {
  if (percentage < 35) return 'weak';
  if (percentage <= 75) return 'average';
  return 'good';
};

export const getTierMessage = (tier: PerformanceTier) => {
  switch (tier) {
    case 'weak':
      return {
        title: 'You need more practice 💪',
        body:
          "Don't worry — every expert was once a beginner. Re-watch the lectures for these chapters, take notes, then come back and solve more practice questions. Consistency beats talent. You've got this!",
      };
    case 'average':
      return {
        title: 'Good effort — keep pushing! 🚀',
        body:
          "You're on the right track. A little more focus and you can move from good to excellent. Solve more practice questions, revisit weak topics, and try this test again. You're closer than you think!",
      };
    case 'good':
      return {
        title: 'Excellent work! 🎉',
        body:
          "Outstanding! You've truly mastered this material. Celebrate this win, then keep the momentum going — aim for a perfect score next time. Top of the class!",
      };
  }
};

const TIER_STYLES: Record<PerformanceTier, { box: string; icon: any; iconColor: string }> = {
  weak: {
    box: 'bg-destructive/10 border-destructive/40 text-destructive-foreground',
    icon: AlertTriangle,
    iconColor: 'text-destructive',
  },
  average: {
    box: 'bg-amber-500/10 border-amber-500/40',
    icon: TrendingUp,
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  good: {
    box: 'bg-green-500/10 border-green-500/40',
    icon: PartyPopper,
    iconColor: 'text-green-600 dark:text-green-400',
  },
};

interface Props {
  percentage: number;
}

export const PerformanceTierBanner = ({ percentage }: Props) => {
  const tier = getTier(percentage);
  const { title, body } = getTierMessage(tier);
  const style = TIER_STYLES[tier];
  const Icon = style.icon;

  return (
    <Card className={cn('p-6 border-2', style.box)}>
      <div className="flex items-start gap-4">
        <div className={cn('shrink-0 rounded-full p-3 bg-background/40', style.iconColor)}>
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-5 w-5" />
            <span className="text-3xl font-bold tabular-nums">{percentage}%</span>
            <span className="text-sm font-medium uppercase tracking-wider opacity-70">
              {tier === 'weak' ? 'Needs Improvement' : tier === 'average' ? 'Average' : 'Excellent'}
            </span>
          </div>
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-sm opacity-90 leading-relaxed">{body}</p>
        </div>
      </div>
    </Card>
  );
};
