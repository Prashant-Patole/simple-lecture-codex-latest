/**
 * PlayerNebulaBackground - Looping video background for the educational player.
 * Replaces the animated SVG nebula with a seamless video loop.
 */
export const PlayerNebulaBackground = () => {
  return (
    <div className="player-video-background">
      <video
        autoPlay
        loop
        muted
        playsInline
        src="/media/intro-background.mp4"
      />
    </div>
  );
};

export default PlayerNebulaBackground;
