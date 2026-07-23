import { supabase } from "@/integrations/supabase/client";

export interface ImageUploadResult {
  url: string;
  error?: string;
}

export const uploadQuestionImage = async (
  file: File,
  questionId: string,
  type: 'question' | 'option_a' | 'option_b' | 'option_c' | 'option_d' | 'explanation'
): Promise<ImageUploadResult> => {
  try {
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { url: '', error: 'Image size must be less than 5MB' };
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { url: '', error: 'Only PNG, JPG, and WebP images are allowed' };
    }

    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();

    // Step 1: Upload to temp-uploads bucket
    const tempPath = `question-img-${questionId}-${type}-${timestamp}.${fileExt}`;
    const { error: tempUploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(tempPath, file, { cacheControl: '3600', upsert: false });

    if (tempUploadError) throw tempUploadError;

    // Step 2: Call b2-upload edge function
    const b2FilePath = `question-images/${questionId}/${type}_${timestamp}.${fileExt}`;
    const { data, error: fnError } = await supabase.functions.invoke('b2-upload', {
      body: {
        storagePath: tempPath,
        filePath: b2FilePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        metadata: {
          entityType: 'question_image',
        }
      }
    });

    if (fnError) throw fnError;
    if (data?.error) throw new Error(data.error);

    // Step 3: Return the B2 file path (used with b2-get-download-url for rendering)
    const publicUrl = data?.filePath || b2FilePath;
    return { url: publicUrl };
  } catch (error: any) {
    console.error('Image upload error:', error);
    return { url: '', error: error.message || 'Failed to upload image' };
  }
};

export const extractImagesFromClipboard = async (
  clipboardData: DataTransfer
): Promise<{ text: string; images: File[] }> => {
  let text = '';
  const images: File[] = [];

  const items = clipboardData.items;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (item.type.indexOf('text/plain') !== -1) {
      text = await new Promise<string>((resolve) => {
        item.getAsString(resolve);
      });
    } else if (item.type.indexOf('text/html') !== -1) {
      const html = await new Promise<string>((resolve) => {
        item.getAsString(resolve);
      });
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      text = tempDiv.textContent || tempDiv.innerText || '';
    } else if (item.type.indexOf('image') !== -1) {
      const blob = item.getAsFile();
      if (blob) {
        images.push(blob);
      }
    }
  }

  return { text, images };
};

export const deleteQuestionImage = async (imageUrl: string): Promise<boolean> => {
  // B2 deletion is handled separately if needed; no-op for now
  console.log('Delete requested for B2 image:', imageUrl);
  return true;
};
