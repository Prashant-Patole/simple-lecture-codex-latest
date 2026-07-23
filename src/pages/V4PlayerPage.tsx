import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { V4PlayerDialog } from "@/components/learning/V4PlayerDialog";

const V4PlayerPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(true);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // If we're embedded (e.g. homepage hero iframe), tell the parent to
      // unmount us instead of navigating this iframe to /dashboard — that
      // navigation is what caused the mobile homepage to render inside the
      // hero video box after clicking the close (×) button.
      const embedded = (() => {
        try {
          return window.parent && window.parent !== window;
        } catch {
          return true; // cross-origin — treat as embedded
        }
      })();
      if (embedded) {
        try {
          window.parent.postMessage({ type: "hero-v4-close" }, "*");
        } catch {
          /* ignore */
        }
        return;
      }
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <V4PlayerDialog
        open={open}
        onOpenChange={handleOpenChange}
        documentName="V4 Player (Testing)"
        initialJobId={params.get("job") || undefined}
        initialLanguage={params.get("lang")}
      />
    </div>
  );
};

export default V4PlayerPage;
