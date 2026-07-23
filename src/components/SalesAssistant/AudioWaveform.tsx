interface AudioWaveformProps {
  isActive: boolean;
  color?: string;
}

export const AudioWaveform = ({ isActive, color = "bg-primary" }: AudioWaveformProps) => {
  const bars = [
    { delay: 0, duration: 0.4 },
    { delay: 0.1, duration: 0.5 },
    { delay: 0.2, duration: 0.3 },
    { delay: 0.15, duration: 0.6 },
    { delay: 0.05, duration: 0.4 },
    { delay: 0.25, duration: 0.5 },
    { delay: 0.1, duration: 0.35 },
  ];

  return (
    <div className="flex items-end justify-center gap-1 h-12">
      {bars.map((bar, index) => (
        <div
          key={index}
          className={`w-1 rounded-full transition-all ${color} ${
            isActive ? "waveform-bar" : "h-2"
          }`}
          style={
            isActive
              ? {
                  animationDelay: `${bar.delay}s`,
                  animationDuration: `${bar.duration}s`,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
};
