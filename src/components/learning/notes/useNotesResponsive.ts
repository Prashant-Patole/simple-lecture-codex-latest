import { useEffect, useState } from "react";

export type NotesLayout = "mobile" | "tablet" | "desktop";

const compute = (): NotesLayout => {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
};

export function useNotesResponsive(): NotesLayout {
  const [layout, setLayout] = useState<NotesLayout>(compute);

  useEffect(() => {
    const onResize = () => setLayout(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return layout;
}
