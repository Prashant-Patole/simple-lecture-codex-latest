import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GenerateImageParams {
  entityType: 'subject' | 'category' | 'course';
  entityName: string;
  entityDescription: string;
}

interface GeneratedImage {
  entityName: string;
  entityType: string;
  imageUrl: string;
}

export const useGenerateSeedImages = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  const generateImage = async ({ entityType, entityName, entityDescription }: GenerateImageParams) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-seed-images', {
        body: { entityType, entityName, entityDescription }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate image');

      return data.imageUrl as string;
    } catch (error) {
      console.error(`Error generating image for ${entityName}:`, error);
      toast.error(`Failed to generate image for ${entityName}`);
      throw error;
    }
  };

  const generateAllImages = async () => {
    setIsGenerating(true);
    setGeneratedImages([]);
    
    // Define all entities from seed data
    const categories = [
      { name: 'Engineering Entrance', description: 'Prepare for engineering entrance exams like JEE Main and JEE Advanced' },
      { name: 'Medical Entrance', description: 'Comprehensive preparation for NEET and AIIMS' },
      { name: 'Board Exams', description: 'CBSE, ICSE and State board exam preparation' },
      { name: 'Competitive Exams', description: 'Civil services, banking and other competitive exams' },
      { name: 'JEE Main', description: 'JEE Main preparation courses' },
      { name: 'JEE Advanced', description: 'JEE Advanced preparation courses' },
      { name: 'NEET', description: 'NEET exam preparation' },
      { name: 'Class 11', description: 'Class 11 board exam preparation' },
      { name: 'Class 12', description: 'Class 12 board exam preparation' },
    ];

    const subjects = [
      { name: 'Physics', description: 'Master fundamental concepts of physics including mechanics, thermodynamics, electromagnetism, optics and modern physics' },
      { name: 'Chemistry', description: 'Comprehensive coverage of physical, organic and inorganic chemistry with practical applications' },
      { name: 'Mathematics', description: 'Complete mathematics curriculum covering algebra, calculus, trigonometry, coordinate geometry and more' },
      { name: 'Biology', description: 'In-depth study of botany, zoology, human physiology, genetics and biotechnology' },
      { name: 'English', description: 'English language, literature, grammar and communication skills' },
      { name: 'Computer Science', description: 'Programming, data structures, algorithms and computer fundamentals' },
    ];

    const courses = [
      { name: 'JEE Main 2026 Complete Course', description: 'Complete preparation course for JEE Main 2026 with live classes and AI tutor' },
      { name: 'NEET 2026 Foundation Course', description: 'Foundation course for NEET 2026 aspirants with Biology focus' },
      { name: 'Class 12 Physics Mastery', description: 'Master Class 12 Physics with board exam focus' },
      { name: 'Class 11 Mathematics Foundation', description: 'Strong mathematical foundation for Class 11 students' },
    ];

    const allEntities = [
      ...categories.map(c => ({ type: 'category' as const, ...c })),
      ...subjects.map(s => ({ type: 'subject' as const, ...s })),
      ...courses.map(c => ({ type: 'course' as const, ...c })),
    ];

    setProgress({ current: 0, total: allEntities.length });

    const results: GeneratedImage[] = [];

    for (let i = 0; i < allEntities.length; i++) {
      const entity = allEntities[i];
      
      try {
        toast.loading(`Generating image ${i + 1}/${allEntities.length}: ${entity.name}...`);
        
        const imageUrl = await generateImage({
          entityType: entity.type,
          entityName: entity.name,
          entityDescription: entity.description,
        });

        results.push({
          entityName: entity.name,
          entityType: entity.type,
          imageUrl,
        });

        setProgress({ current: i + 1, total: allEntities.length });
        toast.success(`Generated image for ${entity.name}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to generate image for ${entity.name}:`, error);
        // Continue with next entity even if one fails
      }
    }

    setGeneratedImages(results);
    setIsGenerating(false);
    
    toast.success(`Generated ${results.length}/${allEntities.length} images successfully!`);
    
    return results;
  };

  return {
    generateImage,
    generateAllImages,
    isGenerating,
    progress,
    generatedImages,
  };
};
