-- Phase 1: Remove program_id constraint and drop programs table

-- Step 1.1: Make program_id nullable in courses table
ALTER TABLE courses ALTER COLUMN program_id DROP NOT NULL;

-- Step 1.2: Drop programs table completely
DROP TABLE IF EXISTS programs CASCADE;