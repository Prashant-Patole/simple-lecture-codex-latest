import { useEffect, useState, useMemo } from 'react';

const funFacts = [
  "💡 Light travels at 299,792 km/s!",
  "🧪 Water exists naturally in all three states!",
  "📐 Zero can't be represented in Roman numerals!",
  "🧬 Your DNA could stretch from Earth to the Sun 600 times!",
  "⚛️ A teaspoon of neutron star would weigh 6 billion tons!",
  "🔬 Honey never spoils due to its unique composition!",
  "∞ More chess games possible than atoms in the universe!",
  "🌿 Octopuses have three hearts and blue blood!",
];

// Physics Atom Icon
const PhysicsIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="30" r="6" className="fill-blue-400" />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-blue-300 stroke-2 fill-none" />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-cyan-300 stroke-2 fill-none" style={{ transform: 'rotate(60deg)', transformOrigin: 'center' }} />
    <ellipse cx="30" cy="30" rx="20" ry="8" className="stroke-sky-300 stroke-2 fill-none" style={{ transform: 'rotate(-60deg)', transformOrigin: 'center' }} />
    <circle cx="50" cy="30" r="3" className="fill-blue-200" />
    <circle cx="20" cy="22" r="3" className="fill-cyan-200" />
  </svg>
);

// Chemistry Flask
const ChemistryIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M20 10 L20 25 L10 50 L50 50 L40 25 L40 10" className="stroke-emerald-400 stroke-2 fill-emerald-400/30" />
    <rect x="18" y="8" width="24" height="4" rx="1" className="fill-emerald-300" />
    <ellipse cx="30" cy="42" rx="15" ry="5" className="fill-teal-400/50" />
    <circle cx="22" cy="38" r="2" className="fill-teal-200" />
    <circle cx="36" cy="40" r="2" className="fill-cyan-200" />
  </svg>
);

// Maths Pi
const MathsIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="38" textAnchor="middle" className="fill-purple-400 text-3xl font-bold">π</text>
    <text x="12" y="20" className="fill-pink-300 text-xs">∫</text>
    <text x="48" y="18" className="fill-violet-300 text-xs">∑</text>
    <text x="10" y="50" className="fill-fuchsia-300 text-xs">∞</text>
  </svg>
);

// Biology DNA
const BiologyIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M20 10 Q30 20 40 10 Q30 25 20 20 Q30 35 40 25 Q30 40 20 35 Q30 50 40 40 Q30 55 20 50" className="stroke-green-400 stroke-2 fill-none" />
    <path d="M40 10 Q30 20 20 10 Q30 25 40 20 Q30 35 20 25 Q30 40 40 35 Q30 50 20 40 Q30 55 40 50" className="stroke-lime-400 stroke-2 fill-none" />
    <circle cx="30" cy="15" r="3" className="fill-green-300" />
    <circle cx="30" cy="30" r="3" className="fill-emerald-300" />
    <circle cx="30" cy="45" r="3" className="fill-lime-300" />
  </svg>
);

// Magnet
const MagnetIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M15 15 L15 35 Q15 50 30 50 Q45 50 45 35 L45 15" className="stroke-red-400 stroke-4 fill-none" strokeLinecap="round" />
    <rect x="10" y="10" width="12" height="10" rx="2" className="fill-red-500" />
    <rect x="38" y="10" width="12" height="10" rx="2" className="fill-blue-500" />
  </svg>
);

// Beaker
const BeakerIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M18 8 L18 25 L12 50 L48 50 L42 25 L42 8" className="stroke-cyan-400 stroke-2 fill-cyan-400/20" />
    <line x1="15" y1="8" x2="45" y2="8" className="stroke-cyan-300 stroke-2" />
    <ellipse cx="30" cy="40" rx="12" ry="4" className="fill-teal-400/60" />
  </svg>
);

// Planet
const PlanetIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="30" r="15" className="fill-orange-400" />
    <ellipse cx="30" cy="30" rx="25" ry="6" className="stroke-orange-300 stroke-2 fill-none" style={{ transform: 'rotate(-20deg)', transformOrigin: 'center' }} />
    <circle cx="25" cy="25" r="3" className="fill-orange-300/50" />
  </svg>
);

// Leaf
const LeafIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M30 50 Q15 35 20 20 Q30 10 40 20 Q45 35 30 50" className="fill-green-400 stroke-green-500 stroke-1" />
    <path d="M30 50 L30 25" className="stroke-green-600 stroke-2" />
    <path d="M30 35 L25 30" className="stroke-green-500 stroke-1" />
    <path d="M30 30 L35 25" className="stroke-green-500 stroke-1" />
  </svg>
);

// Test Tube
const TestTubeIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M22 8 L22 40 Q22 52 30 52 Q38 52 38 40 L38 8" className="stroke-violet-400 stroke-2 fill-violet-400/20" />
    <line x1="18" y1="8" x2="42" y2="8" className="stroke-violet-300 stroke-2" />
    <ellipse cx="30" cy="42" rx="6" ry="3" className="fill-fuchsia-400/70" />
  </svg>
);

// Graph
const GraphIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <line x1="10" y1="50" x2="50" y2="50" className="stroke-blue-400 stroke-2" />
    <line x1="10" y1="50" x2="10" y2="10" className="stroke-blue-400 stroke-2" />
    <polyline points="10,40 20,35 30,20 40,25 50,15" className="stroke-cyan-400 stroke-2 fill-none" />
    <circle cx="30" cy="20" r="2" className="fill-cyan-300" />
  </svg>
);

// Cell
const CellIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <ellipse cx="30" cy="30" rx="22" ry="18" className="fill-lime-400/30 stroke-lime-400 stroke-2" />
    <circle cx="30" cy="30" r="8" className="fill-green-500/50 stroke-green-500 stroke-1" />
    <circle cx="30" cy="30" r="3" className="fill-green-600" />
    <circle cx="18" cy="25" r="3" className="fill-lime-300/50" />
    <circle cx="42" cy="32" r="2" className="fill-lime-300/50" />
  </svg>
);

// Equation
const EquationIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <text x="30" y="35" textAnchor="middle" className="fill-indigo-400 text-sm font-mono">E=mc²</text>
  </svg>
);

// Microscope
const MicroscopeIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <rect x="25" y="45" width="20" height="5" rx="1" className="fill-gray-400" />
    <rect x="32" y="20" width="6" height="25" className="fill-gray-500" />
    <ellipse cx="35" cy="18" rx="8" ry="4" className="fill-gray-400 stroke-gray-500 stroke-1" />
    <circle cx="35" cy="12" r="6" className="fill-blue-400/50 stroke-blue-400 stroke-2" />
  </svg>
);

// Wave
const WaveIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M5 30 Q15 15 25 30 Q35 45 45 30 Q55 15 55 30" className="stroke-sky-400 stroke-2 fill-none" />
    <path d="M5 35 Q15 20 25 35 Q35 50 45 35 Q55 20 55 35" className="stroke-blue-300/50 stroke-1 fill-none" />
  </svg>
);

// Prism
const PrismIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <polygon points="30,10 10,50 50,50" className="fill-transparent stroke-pink-400 stroke-2" />
    <line x1="5" y1="30" x2="25" y2="30" className="stroke-white stroke-1" />
    <line x1="35" y1="35" x2="55" y2="20" className="stroke-red-400 stroke-1" />
    <line x1="35" y1="35" x2="55" y2="35" className="stroke-green-400 stroke-1" />
    <line x1="35" y1="35" x2="55" y2="50" className="stroke-blue-400 stroke-1" />
  </svg>
);

// Molecule
const MoleculeIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="20" r="8" className="fill-blue-400" />
    <circle cx="18" cy="42" r="6" className="fill-red-400" />
    <circle cx="42" cy="42" r="6" className="fill-red-400" />
    <line x1="30" y1="28" x2="18" y2="36" className="stroke-gray-400 stroke-2" />
    <line x1="30" y1="28" x2="42" y2="36" className="stroke-gray-400 stroke-2" />
  </svg>
);

// Compass
const CompassIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <circle cx="30" cy="30" r="20" className="stroke-amber-400 stroke-2 fill-none" />
    <polygon points="30,15 33,30 30,35 27,30" className="fill-red-500" />
    <polygon points="30,45 33,30 30,25 27,30" className="fill-gray-400" />
    <circle cx="30" cy="30" r="3" className="fill-amber-300" />
  </svg>
);

// Heart (Biology)
const HeartIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M30 50 C15 35 5 25 15 15 C22 8 30 15 30 20 C30 15 38 8 45 15 C55 25 45 35 30 50" className="fill-rose-400 stroke-rose-500 stroke-1" />
  </svg>
);

// Gear
const GearIcon = () => (
  <svg viewBox="0 0 60 60" className="w-full h-full">
    <path d="M30 18 L33 18 L35 12 L38 12 L40 18 L43 20 L48 17 L50 20 L47 25 L48 28 L54 29 L54 33 L48 34 L47 37 L50 42 L48 45 L43 42 L40 44 L38 50 L35 50 L33 44 L30 44 L28 50 L25 50 L23 44 L20 42 L15 45 L12 42 L15 37 L14 34 L8 33 L8 29 L14 28 L15 25 L12 20 L15 17 L20 20 L23 18 L25 12 L28 12 L30 18" className="fill-slate-400 stroke-slate-500 stroke-1" />
    <circle cx="30" cy="30" r="8" className="fill-slate-600" />
  </svg>
);

const iconComponents = [
  PhysicsIcon, ChemistryIcon, MathsIcon, BiologyIcon,
  MagnetIcon, BeakerIcon, PlanetIcon, LeafIcon,
  TestTubeIcon, GraphIcon, CellIcon, EquationIcon,
  MicroscopeIcon, WaveIcon, PrismIcon, MoleculeIcon,
  CompassIcon, HeartIcon, GearIcon
];

const floatAnimations = [
  'animate-float-1',
  'animate-float-2', 
  'animate-float-3',
  'animate-float-4',
  'animate-wobble',
  'animate-spin-slow',
  'animate-pulse-soft',
  'animate-bounce-soft',
  'animate-float-diagonal',
];

const DPPGeneratingAnimation = () => {
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Generate grid-based positioned icons to fill entire background evenly
  const randomIcons = useMemo(() => {
    const GRID_COLS = 7;
    const GRID_ROWS = 6;
    const TOTAL_ICONS = GRID_COLS * GRID_ROWS; // 42 icons
    
    return Array(TOTAL_ICONS).fill(null).map((_, i) => {
      const IconComponent = iconComponents[i % iconComponents.length];
      
      // Calculate grid position
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      
      // Base position (percentage of container)
      const cellWidth = 100 / GRID_COLS;
      const cellHeight = 100 / GRID_ROWS;
      
      // Add small random offset within cell (±20% of cell size)
      const offsetX = (Math.random() - 0.5) * cellWidth * 0.4;
      const offsetY = (Math.random() - 0.5) * cellHeight * 0.4;
      
      // Size varies but smaller to fit cells
      const size = 40 + Math.random() * 30; // 40-70px
      
      return {
        id: i,
        Component: IconComponent,
        style: {
          position: 'absolute' as const,
          top: `${row * cellHeight + cellHeight / 2 + offsetY}%`,
          left: `${col * cellWidth + cellWidth / 2 + offsetX}%`,
          transform: `translate(-50%, -50%) rotate(${Math.random() * 40 - 20}deg)`,
          opacity: 0.4 + Math.random() * 0.35,
          width: `${size}px`,
          height: `${size}px`,
          animationDelay: `${Math.random() * 3}s`,
        },
        animationClass: floatAnimations[Math.floor(Math.random() * floatAnimations.length)]
      };
    });
  }, []);

  return (
    <div className="relative min-h-[500px] w-full flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/50">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-animated opacity-30" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      {/* Random floating icons across entire background */}
      <div className="absolute inset-0 overflow-hidden">
        {randomIcons.map(({ id, Component, style, animationClass }) => (
          <div
            key={id}
            className={animationClass}
            style={style}
          >
            <Component />
          </div>
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array(20).fill(null).map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-primary/20 animate-float-particle"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${7 + Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Center content card */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 py-8 bg-background/85 backdrop-blur-md rounded-xl border border-border/50 shadow-2xl max-w-sm mx-4">
        <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-primary via-primary to-pink-500 bg-clip-text text-transparent">
          Generating Your DPP...
        </h3>
        <p className="text-muted-foreground mb-6 text-sm">
          AI is crafting personalized questions just for you
        </p>

        {/* Animated progress bar */}
        <div className="w-full h-2.5 bg-muted/50 rounded-full overflow-hidden mb-6">
          <div className="h-full w-full bg-gradient-to-r from-primary via-primary to-pink-500 animate-shimmer-progress rounded-full" />
        </div>

        {/* Rotating fun facts */}
        <div className="min-h-[40px] flex items-center justify-center">
          <p 
            key={factIndex}
            className="text-xs text-muted-foreground/80 italic animate-fade-in"
          >
            {funFacts[factIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DPPGeneratingAnimation;