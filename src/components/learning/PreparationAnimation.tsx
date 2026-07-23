import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

// Physics - Atom with orbiting electrons
const PhysicsIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="30" r="6" className="fill-blue-400" />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-blue-300 stroke-2 fill-none" />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-cyan-300 stroke-2 fill-none" style={{ transform: 'rotate(60deg)', transformOrigin: 'center' }} />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-sky-300 stroke-2 fill-none" style={{ transform: 'rotate(-60deg)', transformOrigin: 'center' }} />
  </svg>
);

// Chemistry - Flask
const ChemistryIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M22 10 L22 25 L10 50 L50 50 L38 25 L38 10" className="stroke-green-400 stroke-2 fill-green-400/20" />
    <rect x="20" y="5" width="20" height="8" rx="2" className="fill-green-300" />
    <circle cx="25" cy="40" r="3" className="fill-green-300/60" />
    <circle cx="35" cy="38" r="2" className="fill-green-200/60" />
  </svg>
);

// Maths - Pi Symbol
const MathsIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="42" textAnchor="middle" className="fill-purple-400 text-3xl font-serif">π</text>
  </svg>
);

// Biology - DNA Helix
const BiologyIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M20 10 Q30 20 40 10 Q30 0 20 10" className="stroke-pink-400 stroke-2 fill-none" />
    <path d="M20 25 Q30 35 40 25 Q30 15 20 25" className="stroke-pink-300 stroke-2 fill-none" />
    <path d="M20 40 Q30 50 40 40 Q30 30 20 40" className="stroke-pink-400 stroke-2 fill-none" />
    <path d="M20 55 Q30 65 40 55 Q30 45 20 55" className="stroke-pink-300 stroke-2 fill-none" />
    <line x1="25" y1="10" x2="35" y2="10" className="stroke-pink-200 stroke-1" />
    <line x1="25" y1="25" x2="35" y2="25" className="stroke-pink-200 stroke-1" />
    <line x1="25" y1="40" x2="35" y2="40" className="stroke-pink-200 stroke-1" />
  </svg>
);

// Sigma Symbol
const SigmaIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="42" textAnchor="middle" className="fill-indigo-400 text-3xl font-serif">Σ</text>
  </svg>
);

// Infinity Symbol
const InfinityIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="40" textAnchor="middle" className="fill-cyan-400 text-3xl">∞</text>
  </svg>
);

// Molecule
const MoleculeIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="20" r="6" className="fill-orange-400" />
    <circle cx="15" cy="40" r="5" className="fill-orange-300" />
    <circle cx="45" cy="40" r="5" className="fill-orange-300" />
    <line x1="30" y1="26" x2="18" y2="36" className="stroke-orange-400 stroke-2" />
    <line x1="30" y1="26" x2="42" y2="36" className="stroke-orange-400 stroke-2" />
  </svg>
);

// Wave
const WaveIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M5 30 Q15 10 25 30 Q35 50 45 30 Q55 10 60 30" className="stroke-teal-400 stroke-2 fill-none" />
  </svg>
);

// Cell
const CellIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <ellipse cx="30" cy="30" rx="22" ry="18" className="stroke-rose-400 stroke-2 fill-rose-400/10" />
    <circle cx="30" cy="30" r="8" className="fill-rose-300/40 stroke-rose-400 stroke-1" />
    <circle cx="30" cy="30" r="3" className="fill-rose-500" />
  </svg>
);

// Prism
const PrismIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <polygon points="30,10 10,50 50,50" className="stroke-violet-400 stroke-2 fill-violet-400/20" />
    <line x1="30" y1="30" x2="55" y2="25" className="stroke-red-400 stroke-1" />
    <line x1="30" y1="30" x2="55" y2="30" className="stroke-yellow-400 stroke-1" />
    <line x1="30" y1="30" x2="55" y2="35" className="stroke-blue-400 stroke-1" />
  </svg>
);

const iconComponents = [
  PhysicsIcon,
  ChemistryIcon,
  MathsIcon,
  BiologyIcon,
  SigmaIcon,
  InfinityIcon,
  MoleculeIcon,
  WaveIcon,
  CellIcon,
  PrismIcon,
];

const floatAnimations = [
  'animate-wobble',
  'animate-spin-slow',
  'animate-pulse',
  'animate-bounce',
  'animate-float-particle',
];

interface PreparationAnimationProps {
  className?: string;
}

export const PreparationAnimation: React.FC<PreparationAnimationProps> = ({ className }) => {
  // Generate grid-positioned floating icons
  const randomIcons = useMemo(() => {
    const GRID_COLS = 6;
    const GRID_ROWS = 5;
    const TOTAL_ICONS = GRID_COLS * GRID_ROWS;
    
    return Array(TOTAL_ICONS).fill(null).map((_, i) => {
      const IconComponent = iconComponents[i % iconComponents.length];
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const cellWidth = 100 / GRID_COLS;
      const cellHeight = 100 / GRID_ROWS;
      
      // Add some randomness to positions within each cell
      const offsetX = (Math.random() - 0.5) * 8;
      const offsetY = (Math.random() - 0.5) * 8;
      
      return {
        id: i,
        Component: IconComponent,
        style: {
          position: 'absolute' as const,
          top: `${row * cellHeight + cellHeight / 2 + offsetY}%`,
          left: `${col * cellWidth + cellWidth / 2 + offsetX}%`,
          transform: `translate(-50%, -50%) rotate(${Math.random() * 40 - 20}deg)`,
          opacity: 0.25 + Math.random() * 0.25,
          width: `${35 + Math.random() * 25}px`,
          height: `${35 + Math.random() * 25}px`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${3 + Math.random() * 4}s`,
        },
        animationClass: floatAnimations[Math.floor(Math.random() * floatAnimations.length)]
      };
    });
  }, []);

  return (
    <div className={cn("relative min-h-[400px] w-full h-full flex items-center justify-center overflow-hidden", className)}>
      {/* Floating educational icons */}
      <div className="absolute inset-0 overflow-hidden">
        {randomIcons.map(({ id, Component, style, animationClass }) => (
          <div key={id} className={animationClass} style={style}>
            <Component />
          </div>
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array(15).fill(null).map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-primary/20 animate-float-particle"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${6 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Center content card */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 py-8 bg-background/90 backdrop-blur-md rounded-xl border border-border/50 shadow-2xl max-w-sm">
        <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-primary via-primary to-pink-500 bg-clip-text text-transparent">
          Preparing presentation...
        </h3>
        
        {/* Animated progress bar */}
        <div className="w-full h-2.5 bg-muted/50 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full w-full bg-gradient-to-r from-primary via-primary to-pink-500 rounded-full animate-pulse"
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s ease-in-out infinite',
            }}
          />
        </div>
        
        <p className="text-sm text-muted-foreground">
          This may take a few minutes
        </p>
      </div>

      {/* Add shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};
