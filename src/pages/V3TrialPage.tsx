import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { V3PlayerDialog } from "@/components/learning/V3PlayerDialog";

/**
 * Trial route: renders the V3 player for a single marketing job, showing
 * only Manim/video visual beats with the chosen language avatar.
 * Example: /v3-trial?job=SocialScience_20260630115302591_5462fd6a&lang=kannada
 */
const V3TrialPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(true);

  const jobId = params.get("job") || "SocialScience_20260630115302591_5462fd6a";
  const lang = params.get("lang") || "kannada";

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) navigate("/");
  };

  return (
    <div className="min-h-screen bg-black">
      <V3PlayerDialog
        open={open}
        onOpenChange={handleOpenChange}
        documentName="V3 Trial — Video Beats Only"
        initialJobId={jobId}
        initialLanguage={lang}
        videoBeatsOnly
      />
    </div>
  );
};

export default V3TrialPage;
