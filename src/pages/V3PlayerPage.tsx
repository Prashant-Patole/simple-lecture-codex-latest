import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { V3PlayerDialog } from "@/components/learning/V3PlayerDialog";

const V3PlayerPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(true);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <V3PlayerDialog open={open} onOpenChange={handleOpenChange} documentName="V3 Player" initialJobId={params.get("job") || undefined} initialLanguage={params.get("lang")} />
    </div>
  );
};

export default V3PlayerPage;
