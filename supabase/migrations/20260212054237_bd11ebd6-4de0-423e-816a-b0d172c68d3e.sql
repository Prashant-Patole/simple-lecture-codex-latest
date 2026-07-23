UPDATE video_generation_jobs 
SET status = 'completed_with_errors', 
    completed_at = NOW(),
    error_message = 'Completed with errors (auto-fixed from stuck processing)'
WHERE id = '815905161' AND status = 'processing';