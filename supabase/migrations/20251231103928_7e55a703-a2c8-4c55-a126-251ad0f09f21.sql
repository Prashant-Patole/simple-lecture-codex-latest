-- Add paper_category column to subject_previous_year_papers table
ALTER TABLE subject_previous_year_papers 
ADD COLUMN paper_category TEXT DEFAULT 'previous_year' 
CHECK (paper_category IN ('previous_year', 'proficiency', 'exam'));