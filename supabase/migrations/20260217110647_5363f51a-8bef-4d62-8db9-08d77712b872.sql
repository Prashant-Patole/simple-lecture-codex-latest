-- Step 1: Cancel Physics, Maths, Science pipeline runs
UPDATE auto_pipeline_runs 
SET status = 'cancelled', updated_at = now() 
WHERE id IN (
  '287f9d53-77a0-4024-a191-5571df81a3e3',
  '11c6f61e-cdb7-462d-9307-ee205816fe25',
  'cebafa03-5ac5-473e-8b54-e3a78a1b191e'
);

-- Step 2: Clean up stale scan_complete and scanning runs
UPDATE auto_pipeline_runs 
SET status = 'cancelled', updated_at = now() 
WHERE status IN ('scan_complete', 'scanning');