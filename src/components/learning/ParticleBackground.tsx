import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  id: number;
  size: number;
  left: string;
  animationDuration: string;
  animationDelay: string;
  opacity: number;
}

interface ParticleBackgroundProps {
  className?: string;
  particleCount?: number;
}

export function ParticleBackground({ className, particleCount = 30 }: ParticleBackgroundProps) {
  const particles = useMemo<Particle[]>(() => {
    return Array(particleCount).fill(null).map((_, i) => ({
      id: i,
      size: 2 + Math.random() * 4,
      left: `${Math.random() * 100}%`,
      animationDuration: `${8 + Math.random() * 12}s`,
      animationDelay: `${Math.random() * 5}s`,
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, [particleCount]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-secondary/5" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      
      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary animate-particle-float"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: particle.left,
            bottom: '-20px',
            opacity: particle.opacity,
            animationDuration: particle.animationDuration,
            animationDelay: particle.animationDelay,
            boxShadow: `0 0 ${particle.size * 2}px hsl(var(--primary) / 0.5)`,
          }}
        />
      ))}
      
      {/* Subtle orbs */}
      <div 
        className="absolute w-64 h-64 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.1), transparent 70%)',
          top: '10%',
          right: '10%',
        }}
      />
      <div 
        className="absolute w-48 h-48 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, hsl(var(--secondary) / 0.08), transparent 70%)',
          bottom: '20%',
          left: '5%',
        }}
      />
    </div>
  );
}
