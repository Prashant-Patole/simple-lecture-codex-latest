import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ListeningAnimationProps {
  isListening: boolean;
  className?: string;
  particleCount?: number;
}

interface Dot {
  id: number;
  angle: number;
  radius: number;
  size: number;
  delay: number;
  duration: number;
  colorType: 'primary' | 'secondary' | 'accent';
}

export function ListeningAnimation({ 
  isListening, 
  className,
  particleCount = 60 
}: ListeningAnimationProps) {
  const dots = useMemo<Dot[]>(() => {
    const dotsArray: Dot[] = [];
    const rings = 4;
    const dotsPerRing = Math.floor(particleCount / rings);
    
    for (let ring = 0; ring < rings; ring++) {
      const ringRadius = 50 + ring * 30;
      const dotsInThisRing = dotsPerRing + (ring === rings - 1 ? particleCount % rings : 0);
      
      for (let i = 0; i < dotsInThisRing; i++) {
        const angle = (i / dotsInThisRing) * 360;
        dotsArray.push({
          id: ring * dotsPerRing + i,
          angle,
          radius: ringRadius,
          size: 3 + Math.random() * 4,
          delay: (i / dotsInThisRing) * 1.5 + ring * 0.2,
          duration: 1.5 + Math.random() * 0.5,
          colorType: ['primary', 'secondary', 'accent'][ring % 3] as Dot['colorType'],
        });
      }
    }
    
    return dotsArray;
  }, [particleCount]);

  if (!isListening) return null;

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-visible", className)}>
      {/* Central ripple effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 animate-listening-ripple" />
        <div className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/20 animate-listening-ripple" style={{ animationDelay: '0.5s' }} />
        <div className="absolute w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 animate-listening-ripple" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Animated dots in circular pattern */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {dots.map((dot) => {
          const x = Math.cos((dot.angle * Math.PI) / 180) * dot.radius;
          const y = Math.sin((dot.angle * Math.PI) / 180) * dot.radius;
          
          return (
            <div
              key={dot.id}
              className={cn(
                "absolute rounded-full animate-listening-dot",
                dot.colorType === 'primary' && "bg-primary",
                dot.colorType === 'secondary' && "bg-secondary",
                dot.colorType === 'accent' && "bg-accent"
              )}
              style={{
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                animationDelay: `${dot.delay}s`,
                animationDuration: `${dot.duration}s`,
                boxShadow: `0 0 ${dot.size * 2}px hsl(var(--${dot.colorType}) / 0.5)`,
              }}
            />
          );
        })}
      </div>
      
      {/* Floating wave particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={`wave-${i}`}
          className="absolute top-1/2 left-1/2 rounded-full bg-primary/40 animate-listening-wave"
          style={{
            width: '6px',
            height: '6px',
            transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateX(120px)`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
