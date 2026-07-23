import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CounselorAvatars {
  female: string | null;
  male: string | null;
}

export const useGenerateCounselorAvatars = () => {
  const [avatars, setAvatars] = useState<CounselorAvatars>({ female: null, male: null });
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvatarsFromDB();
  }, []);

  const loadAvatarsFromDB = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Fetch avatars from database - instant loading
      const { data: dbAvatars, error: dbError } = await supabase
        .from('counselor_avatars')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (dbError) {
        console.error("DB error loading avatars:", dbError);
        throw dbError;
      }

      if (dbAvatars && dbAvatars.length > 0) {
        // Randomly select one female and one male
        const femaleAvatars = dbAvatars.filter(a => a.gender === 'female');
        const maleAvatars = dbAvatars.filter(a => a.gender === 'male');

        const randomFemale = femaleAvatars.length > 0 
          ? femaleAvatars[Math.floor(Math.random() * femaleAvatars.length)]
          : null;
        const randomMale = maleAvatars.length > 0
          ? maleAvatars[Math.floor(Math.random() * maleAvatars.length)]
          : null;

        console.log("✅ Loaded avatars from database");
        setAvatars({
          female: randomFemale?.image_url || null,
          male: randomMale?.image_url || null
        });
      } else {
        console.log("No avatars in database, using fallbacks");
        setAvatars({ female: null, male: null });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load avatars";
      setError(errorMessage);
      console.error("❌ Avatar loading error:", err);
      // Use null fallbacks - component will show emoji
      setAvatars({ female: null, male: null });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearCache = () => {
    setAvatars({ female: null, male: null });
    loadAvatarsFromDB();
  };

  return {
    avatars,
    isGenerating,
    error,
    regenerate: loadAvatarsFromDB,
    clearCache,
  };
};
