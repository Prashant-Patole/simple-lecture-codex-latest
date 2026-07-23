// Single source of truth for the lecture shown in the homepage hero.
// - `jobId`: video_generation_jobs.external_job_id
// - `vimeoId`: merged final video ID on Vimeo (informational).
// - `videoMp4Url`: signed progressive MP4 pulled from presentation.json's
//   `vimeo_mp4_url`. We use this in the hero because the Vimeo player embed
//   is domain-restricted and returns 403 on non-whitelisted origins.
// - `player`: "v4" for single marketing videos, "educational" for section-wise lectures.
//   Hero.tsx / MobileHomeContent.tsx branch on this to pick the launcher.
export const HOMEPAGE_HERO_LECTURE = {
  jobId: "SocialScience_20260630115302591_5462fd6a",
  vimeoId: "1205802274",
  videoMp4Url:
    "https://player.vimeo.com/progressive_redirect/playback/1205802274/rendition/720p/file.mp4%20%28720p%29.mp4?loc=external&oauth2_token_id=1806524992&signature=58cc606332ec40e26eee1fd34d8c57a5e5354f8eb83b4696201fbe31d45ee9f8",
  title: "Discovery of a New Sea Route to India",
  subtitle: "SSLC 10 — Social Science • Chapter 1 (Topic 1.3)",
  player: "v4" as "v4" | "educational",
};
