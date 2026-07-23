import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedSlideBackgroundProps {
  className?: string;
}

export function AnimatedSlideBackground({ className }: AnimatedSlideBackgroundProps) {
  // Cloud layer shapes - organic, filled bezier paths for nebula effect
  const cloudLayers = useMemo(() => [
    // Full canvas ambient base layers - covers entire background
    {
      id: 1,
      d: "M-200,-50 C200,-150 600,100 900,0 C1200,-100 1400,50 1600,-50 L1600,700 C1400,600 1200,750 900,650 C600,550 200,700 -200,600 Z",
      opacity: 0.15,
      blur: 80,
      animationDelay: '0s',
      fill: 'url(#cloudGradient1)'
    },
    {
      id: 2,
      d: "M-200,50 C100,-80 400,150 700,50 C1000,-50 1300,100 1600,0 L1600,650 C1300,550 1000,700 700,600 C400,500 100,650 -200,550 Z",
      opacity: 0.12,
      blur: 80,
      animationDelay: '4s',
      fill: 'url(#cloudGradient2)'
    },
    // Top area coverage (Y: 0-250)
    {
      id: 3,
      d: "M-100,30 C100,-50 300,100 500,40 C700,-20 900,80 1100,20 C1300,-40 1400,60 1600,10 L1600,220 C1400,160 1300,260 1100,200 C900,140 700,240 500,180 C300,120 100,220 -100,160 Z",
      opacity: 0.35,
      blur: 45,
      animationDelay: '1s',
      fill: 'url(#cloudGradient2)'
    },
    {
      id: 4,
      d: "M-50,80 C150,0 350,160 550,80 C750,0 950,140 1150,60 C1350,-20 1500,100 1650,40 L1650,280 C1500,200 1350,320 1150,240 C950,160 750,280 550,200 C350,120 150,240 -50,180 Z",
      opacity: 0.3,
      blur: 50,
      animationDelay: '3s',
      fill: 'url(#cloudGradient3)'
    },
    // Upper-mid layer (Y: 150-350)
    {
      id: 5,
      d: "M-100,180 C80,100 250,250 450,170 C650,90 800,220 1000,140 C1200,60 1350,180 1500,120 L1500,380 C1350,300 1200,420 1000,340 C800,260 650,380 450,300 C250,220 80,340 -100,280 Z",
      opacity: 0.4,
      blur: 40,
      animationDelay: '0.5s',
      fill: 'url(#cloudGradient1)'
    },
    {
      id: 6,
      d: "M0,220 C150,140 320,300 520,220 C720,140 870,260 1070,180 C1270,100 1420,220 1550,160 L1550,400 C1420,320 1270,440 1070,360 C870,280 720,400 520,320 C320,240 150,360 0,300 Z",
      opacity: 0.35,
      blur: 35,
      animationDelay: '2s',
      fill: 'url(#cloudGradient2)'
    },
    // Center main clouds (Y: 250-420)
    {
      id: 7,
      d: "M-100,280 C100,180 280,340 480,260 C680,180 850,300 1050,220 C1250,140 1400,260 1600,200 L1600,450 C1400,370 1250,490 1050,410 C850,330 680,450 480,370 C280,290 100,410 -100,350 Z",
      opacity: 0.5,
      blur: 30,
      animationDelay: '1.5s',
      fill: 'url(#cloudGradient1)'
    },
    {
      id: 8,
      d: "M-50,320 C120,240 300,400 500,320 C700,240 880,360 1080,280 C1280,200 1450,320 1600,260 L1600,480 C1450,400 1280,520 1080,440 C880,360 700,480 500,400 C300,320 120,440 -50,380 Z",
      opacity: 0.45,
      blur: 25,
      animationDelay: '3.5s',
      fill: 'url(#cloudGradient3)'
    },
    // Lower-mid layer (Y: 350-500)
    {
      id: 9,
      d: "M-100,380 C80,300 250,450 450,370 C650,290 800,420 1000,340 C1200,260 1350,380 1500,320 L1500,540 C1350,460 1200,580 1000,500 C800,420 650,540 450,460 C250,380 80,500 -100,440 Z",
      opacity: 0.4,
      blur: 35,
      animationDelay: '2.5s',
      fill: 'url(#cloudGradient2)'
    },
    {
      id: 10,
      d: "M0,420 C150,340 320,500 520,420 C720,340 870,460 1070,380 C1270,300 1420,420 1550,360 L1550,560 C1420,480 1270,600 1070,520 C870,440 720,560 520,480 C320,400 150,520 0,460 Z",
      opacity: 0.35,
      blur: 40,
      animationDelay: '4.5s',
      fill: 'url(#cloudGradient1)'
    },
    // Bottom area coverage (Y: 450-650)
    {
      id: 11,
      d: "M-100,480 C100,400 300,560 500,480 C700,400 900,520 1100,440 C1300,360 1500,480 1650,420 L1650,700 C1500,620 1300,740 1100,660 C900,580 700,700 500,620 C300,540 100,660 -100,600 Z",
      opacity: 0.35,
      blur: 45,
      animationDelay: '1.5s',
      fill: 'url(#cloudGradient3)'
    },
    {
      id: 12,
      d: "M-50,530 C120,450 280,600 480,520 C680,440 850,560 1050,480 C1250,400 1400,520 1600,460 L1600,700 C1400,620 1250,740 1050,660 C850,580 680,700 480,620 C280,540 120,660 -50,600 Z",
      opacity: 0.3,
      blur: 50,
      animationDelay: '3.5s',
      fill: 'url(#cloudGradient2)'
    },
    // Foreground detail clouds
    {
      id: 13,
      d: "M50,300 C180,200 350,360 550,280 C750,200 900,320 1100,240 C1300,160 1420,280 1550,220 L1550,400 C1420,320 1300,420 1100,340 C900,260 750,380 550,300 C350,220 180,340 50,280 Z",
      opacity: 0.55,
      blur: 20,
      animationDelay: '0.5s',
      fill: 'url(#cloudGradient3)'
    },
    {
      id: 14,
      d: "M-30,380 C100,280 260,420 460,340 C660,260 820,380 1020,300 C1220,220 1380,340 1500,280 L1500,460 C1380,380 1220,480 1020,400 C820,320 660,440 460,360 C260,280 100,400 -30,350 Z",
      opacity: 0.5,
      blur: 15,
      animationDelay: '2.5s',
      fill: 'url(#cloudGradient1)'
    }
  ], []);

  // Orange energy burst clouds
  const energyClouds = useMemo(() => [
    {
      id: 1,
      d: "M-50,300 C50,200 150,350 250,280 C350,210 450,320 550,260 L550,420 C450,360 350,450 250,380 C150,310 50,400 -50,350 Z",
      opacity: 0.6,
      blur: 25,
      animationDelay: '0s'
    },
    {
      id: 2,
      d: "M0,350 C80,260 180,400 280,330 C380,260 480,370 580,310 L580,450 C480,390 380,490 280,420 C180,350 80,450 0,400 Z",
      opacity: 0.45,
      blur: 35,
      animationDelay: '1.5s'
    },
    {
      id: 3,
      d: "M-30,280 C60,180 160,330 260,260 C360,190 460,300 560,240 L560,380 C460,320 360,420 260,350 C160,280 60,380 -30,330 Z",
      opacity: 0.35,
      blur: 45,
      animationDelay: '3s'
    }
  ], []);

  // Scattered sparkle particles
  const sparkles = useMemo(() => Array(50).fill(null).map((_, i) => ({
    id: i,
    cx: Math.random() * 1200,
    cy: Math.random() * 600,
    r: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.6 + 0.2,
    delay: Math.random() * 5,
    isCyan: Math.random() > 0.3
  })), []);

  // Orange sparkles concentrated on left
  const orangeSparkles = useMemo(() => Array(20).fill(null).map((_, i) => ({
    id: i,
    cx: Math.random() * 400,
    cy: Math.random() * 400 + 100,
    r: Math.random() * 2.5 + 1,
    opacity: Math.random() * 0.7 + 0.3,
    delay: Math.random() * 4
  })), []);

  // Thin accent fiber lines
  const fiberLines = useMemo(() => Array(8).fill(null).map((_, i) => {
    const yBase = 200 + i * 40;
    return {
      id: i,
      d: `M0,${yBase} Q300,${yBase - 60 + Math.random() * 40} 600,${yBase - 20 + Math.random() * 30} T1200,${yBase + 30}`,
      opacity: 0.5 + Math.random() * 0.25,
      delay: i * 0.4
    };
  }), []);

  // Get blur filter id based on blur value
  const getBlurFilter = (blur: number) => {
    if (blur >= 60) return 'cloudBlur60';
    if (blur >= 50) return 'cloudBlur50';
    if (blur >= 45) return 'cloudBlur45';
    if (blur >= 35) return 'cloudBlur35';
    if (blur >= 30) return 'cloudBlur30';
    if (blur >= 25) return 'cloudBlur25';
    if (blur >= 20) return 'cloudBlur20';
    return 'cloudBlur15';
  };

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Pure black cosmic background */}
      <div className="absolute inset-0 bg-black" />
      
      {/* Ambient glow spots - expanded coverage */}
      <div 
        className="absolute w-[700px] h-[500px] rounded-full opacity-25"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,212,255,0.35) 0%, rgba(8,145,178,0.15) 40%, transparent 70%)',
          left: '-10%',
          top: '-15%',
          filter: 'blur(60px)'
        }}
      />
      <div 
        className="absolute w-[600px] h-[450px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(ellipse, rgba(34,211,238,0.3) 0%, rgba(6,182,212,0.1) 40%, transparent 70%)',
          right: '-5%',
          top: '-10%',
          filter: 'blur(55px)'
        }}
      />
      <div 
        className="absolute w-[900px] h-[700px] rounded-full opacity-25"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,212,255,0.3) 0%, rgba(8,145,178,0.12) 40%, transparent 70%)',
          left: '25%',
          top: '15%',
          filter: 'blur(70px)'
        }}
      />
      <div 
        className="absolute w-[500px] h-[400px] rounded-full opacity-35"
        style={{
          background: 'radial-gradient(ellipse, rgba(255,165,0,0.45) 0%, rgba(255,107,0,0.18) 40%, transparent 70%)',
          left: '-8%',
          top: '25%',
          filter: 'blur(50px)'
        }}
      />
      <div 
        className="absolute w-[600px] h-[500px] rounded-full opacity-22"
        style={{
          background: 'radial-gradient(ellipse, rgba(103,232,249,0.3) 0%, rgba(14,116,144,0.1) 40%, transparent 70%)',
          right: '-8%',
          bottom: '-10%',
          filter: 'blur(55px)'
        }}
      />
      <div 
        className="absolute w-[700px] h-[550px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,212,255,0.28) 0%, rgba(8,145,178,0.1) 40%, transparent 70%)',
          left: '-5%',
          bottom: '-15%',
          filter: 'blur(60px)'
        }}
      />

      {/* Main SVG with cloud/nebula elements */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Cyan cloud gradients */}
          <linearGradient id="cloudGradient1" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#0891B2" stopOpacity="0" />
            <stop offset="15%" stopColor="#00D4FF" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#67E8F9" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#00D4FF" stopOpacity="0.6" />
            <stop offset="85%" stopColor="#0891B2" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="cloudGradient2" x1="0%" y1="50%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0" />
            <stop offset="20%" stopColor="#22D3EE" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#A5F3FC" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#22D3EE" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="cloudGradient3" x1="0%" y1="30%" x2="100%" y2="70%">
            <stop offset="0%" stopColor="#0E7490" stopOpacity="0" />
            <stop offset="10%" stopColor="#00D4FF" stopOpacity="0.5" />
            <stop offset="35%" stopColor="#E0FFFF" stopOpacity="0.8" />
            <stop offset="65%" stopColor="#67E8F9" stopOpacity="0.7" />
            <stop offset="90%" stopColor="#00D4FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
          </linearGradient>

          {/* Orange energy gradient */}
          <linearGradient id="energyGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.8" />
            <stop offset="30%" stopColor="#FFA500" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#FF8C00" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FF4500" stopOpacity="0" />
          </linearGradient>

          {/* Radial glow for particles */}
          <radialGradient id="cyanGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67E8F9" stopOpacity="1" />
            <stop offset="50%" stopColor="#00D4FF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="orangeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFA500" stopOpacity="1" />
            <stop offset="50%" stopColor="#FF6B00" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FF4500" stopOpacity="0" />
          </radialGradient>

          {/* Heavy blur filters for cloud effect */}
          <filter id="cloudBlur60" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="60" />
          </filter>
          <filter id="cloudBlur50" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="50" />
          </filter>
          <filter id="cloudBlur45" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="45" />
          </filter>
          <filter id="cloudBlur35" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="35" />
          </filter>
          <filter id="cloudBlur30" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
          <filter id="cloudBlur25" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="25" />
          </filter>
          <filter id="cloudBlur20" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <filter id="cloudBlur15" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="15" />
          </filter>

          {/* Glow filter for sparkles */}
          <filter id="sparkleGlow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Cyan cloud layers - nebula effect */}
        {cloudLayers.map((cloud) => (
          <path
            key={`cloud-${cloud.id}`}
            d={cloud.d}
            fill={cloud.fill}
            opacity={cloud.opacity}
            filter={`url(#${getBlurFilter(cloud.blur)})`}
            className="animate-cloud-drift"
            style={{ 
              animationDelay: cloud.animationDelay,
              transformOrigin: 'center center'
            }}
          />
        ))}

        {/* Orange energy clouds on left side */}
        {energyClouds.map((cloud) => (
          <path
            key={`energy-${cloud.id}`}
            d={cloud.d}
            fill="url(#energyGradient)"
            opacity={cloud.opacity}
            filter={`url(#${getBlurFilter(cloud.blur)})`}
            className="animate-energy-pulse"
            style={{ 
              animationDelay: cloud.animationDelay,
              transformOrigin: 'left center'
            }}
          />
        ))}

        {/* Thin fiber accent lines */}
        {fiberLines.map((fiber) => (
          <path
            key={`fiber-${fiber.id}`}
            d={fiber.d}
            fill="none"
            stroke="url(#cloudGradient3)"
            strokeWidth="2"
            opacity={fiber.opacity}
            filter="url(#sparkleGlow)"
            className="animate-fiber-sway"
            style={{ animationDelay: `${fiber.delay}s` }}
          />
        ))}

        {/* Cyan sparkles throughout */}
        {sparkles.map((sparkle) => (
          <circle
            key={`sparkle-${sparkle.id}`}
            cx={sparkle.cx}
            cy={sparkle.cy}
            r={sparkle.r}
            fill={sparkle.isCyan ? "url(#cyanGlow)" : "url(#orangeGlow)"}
            opacity={sparkle.opacity}
            filter="url(#sparkleGlow)"
            className="animate-sparkle"
            style={{ animationDelay: `${sparkle.delay}s` }}
          />
        ))}

        {/* Orange sparkles on left */}
        {orangeSparkles.map((sparkle) => (
          <circle
            key={`orange-sparkle-${sparkle.id}`}
            cx={sparkle.cx}
            cy={sparkle.cy}
            r={sparkle.r}
            fill="url(#orangeGlow)"
            opacity={sparkle.opacity}
            filter="url(#sparkleGlow)"
            className="animate-sparkle-slow"
            style={{ animationDelay: `${sparkle.delay}s` }}
          />
        ))}
      </svg>

      {/* Subtle vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)'
        }}
      />
    </div>
  );
}

export default AnimatedSlideBackground;
