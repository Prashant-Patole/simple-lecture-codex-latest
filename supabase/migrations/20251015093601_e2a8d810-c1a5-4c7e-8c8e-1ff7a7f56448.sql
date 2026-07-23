-- =====================================================
-- Sprint 1: Database Schema Enhancements & Sample Data
-- =====================================================

-- 1. Enhance subject_chapters table with new columns
ALTER TABLE subject_chapters 
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS video_platform TEXT CHECK (video_platform IN ('youtube', 'vimeo')),
ADD COLUMN IF NOT EXISTS notes_markdown TEXT,
ADD COLUMN IF NOT EXISTS ai_generated_video_url TEXT,
ADD COLUMN IF NOT EXISTS ai_generated_podcast_url TEXT;

-- 2. Enhance subject_topics table with new columns
ALTER TABLE subject_topics 
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS video_platform TEXT CHECK (video_platform IN ('youtube', 'vimeo')),
ADD COLUMN IF NOT EXISTS notes_markdown TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS ai_generated_video_url TEXT,
ADD COLUMN IF NOT EXISTS ai_generated_podcast_url TEXT;

-- 3. Enhance subtopics table with new columns
ALTER TABLE subtopics 
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS video_platform TEXT CHECK (video_platform IN ('youtube', 'vimeo')),
ADD COLUMN IF NOT EXISTS notes_markdown TEXT,
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS ai_generated_video_url TEXT,
ADD COLUMN IF NOT EXISTS ai_generated_podcast_url TEXT;

-- 4. Create question_templates table for reusable question formats
CREATE TABLE IF NOT EXISTS question_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES popular_subjects(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  question_format TEXT NOT NULL,
  options JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS on question_templates
ALTER TABLE question_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for question_templates
CREATE POLICY "Admins manage question templates"
  ON question_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active templates"
  ON question_templates FOR SELECT
  USING (is_active = true);

-- 5. Insert sample data for Physics subject
-- Insert chapters for Physics
INSERT INTO subject_chapters (subject_id, chapter_number, title, description, sequence_order)
VALUES 
  ('bc7e6984-8a22-4869-b1d8-732009468abb', 1, 'Electrostatics', 'Electric Charges and Fields, Coulomb''s Law, Electric Field and Potential', 1),
  ('bc7e6984-8a22-4869-b1d8-732009468abb', 2, 'Current Electricity', 'Ohm''s Law, Kirchhoff''s Laws, Resistors and Circuits', 2),
  ('bc7e6984-8a22-4869-b1d8-732009468abb', 3, 'Magnetism and Electromagnetic Induction', 'Magnetic Field, Magnetic Force, Faraday''s Law, Lenz''s Law', 3)
ON CONFLICT (subject_id, chapter_number) DO NOTHING;

-- Insert topics for Electrostatics chapter
WITH electrostatics_chapter AS (
  SELECT id FROM subject_chapters 
  WHERE subject_id = 'bc7e6984-8a22-4869-b1d8-732009468abb' 
  AND chapter_number = 1
)
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  id,
  1,
  'Electric Charges and Fields',
  45,
  1,
  E'# Electric Charges and Fields\n\n## Key Concepts:\n- Properties of electric charges\n- Conservation of charge\n- Quantization of charge\n- Charging by induction and conduction\n\n## Formulas:\n- Charge: q = ne (where n is integer, e = 1.6 × 10⁻¹⁹ C)'
FROM electrostatics_chapter
ON CONFLICT DO NOTHING;

WITH electrostatics_chapter AS (
  SELECT id FROM subject_chapters 
  WHERE subject_id = 'bc7e6984-8a22-4869-b1d8-732009468abb' 
  AND chapter_number = 1
)
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  id,
  2,
  'Coulomb''s Law',
  60,
  2,
  E'# Coulomb''s Law\n\n## Key Concepts:\n- Force between two point charges\n- Superposition principle\n- Electric field intensity\n\n## Formulas:\n- F = k(q₁q₂)/r² where k = 9 × 10⁹ Nm²/C²\n- Electric Field: E = F/q = kQ/r²'
FROM electrostatics_chapter
ON CONFLICT DO NOTHING;

-- 6. Insert sample data for Chemistry subject
-- Insert chapters for Chemistry
INSERT INTO subject_chapters (subject_id, chapter_number, title, description, sequence_order)
VALUES 
  ('4da2da37-aa0d-4c51-93b4-b8974f7b320d', 1, 'Chemical Bonding', 'Ionic, Covalent, and Metallic Bonds, VSEPR Theory, Hybridization', 1),
  ('4da2da37-aa0d-4c51-93b4-b8974f7b320d', 2, 'Organic Chemistry Basics', 'Nomenclature, Isomerism, Reaction Mechanisms', 2),
  ('4da2da37-aa0d-4c51-93b4-b8974f7b320d', 3, 'Chemical Kinetics', 'Rate of Reaction, Order of Reaction, Arrhenius Equation', 3)
ON CONFLICT (subject_id, chapter_number) DO NOTHING;

-- Insert topics for Chemical Bonding
WITH chemical_bonding_chapter AS (
  SELECT id FROM subject_chapters 
  WHERE subject_id = '4da2da37-aa0d-4c51-93b4-b8974f7b320d' 
  AND chapter_number = 1
)
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  id,
  1,
  'Ionic Bonding',
  50,
  1,
  E'# Ionic Bonding\n\n## Key Concepts:\n- Formation of ionic compounds\n- Lattice energy\n- Properties of ionic compounds\n- Born-Haber cycle\n\n## Formulas:\n- Lattice Energy = k(Q₁Q₂)/r'
FROM chemical_bonding_chapter
ON CONFLICT DO NOTHING;

WITH chemical_bonding_chapter AS (
  SELECT id FROM subject_chapters 
  WHERE subject_id = '4da2da37-aa0d-4c51-93b4-b8974f7b320d' 
  AND chapter_number = 1
)
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  id,
  2,
  'Covalent Bonding',
  55,
  2,
  E'# Covalent Bonding\n\n## Key Concepts:\n- Electron sharing\n- Lewis structures\n- Bond parameters: length, energy, angle\n- Sigma and Pi bonds'
FROM chemical_bonding_chapter
ON CONFLICT DO NOTHING;

-- 7. Insert sample data for Mathematics subject
-- Insert chapters for Mathematics
INSERT INTO subject_chapters (subject_id, chapter_number, title, description, sequence_order)
VALUES 
  ('a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 1, 'Differential Calculus', 'Limits, Derivatives, Applications of Derivatives', 1),
  ('a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 2, 'Integral Calculus', 'Integration Techniques, Definite and Indefinite Integrals', 2),
  ('a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 3, 'Differential Equations', 'First Order, Second Order, Applications', 3)
ON CONFLICT (subject_id, chapter_number) DO NOTHING;

-- Insert topics for Differential Calculus
WITH diff_calculus_chapter AS (
  SELECT id FROM subject_chapters 
  WHERE subject_id = 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9' 
  AND chapter_number = 1
)
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  id,
  1,
  'Limits and Continuity',
  55,
  1,
  E'# Limits and Continuity\n\n## Key Concepts:\n- Definition of limits\n- Evaluation of limits\n- L''Hospital''s Rule\n- Continuity of functions\n\n## Formulas:\n- lim(x→a) f(x) = L\n- f is continuous at x=a if lim(x→a) f(x) = f(a)'
FROM diff_calculus_chapter
ON CONFLICT DO NOTHING;

WITH diff_calculus_chapter AS (
  SELECT id FROM subject_chapters 
  WHERE subject_id = 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9' 
  AND chapter_number = 1
)
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  id,
  2,
  'Differentiation',
  70,
  2,
  E'# Differentiation\n\n## Key Concepts:\n- Rules of differentiation\n- Chain rule, product rule, quotient rule\n- Implicit differentiation\n- Higher order derivatives\n\n## Formulas:\n- d/dx(xⁿ) = nxⁿ⁻¹\n- Product Rule: d/dx(uv) = u''v + uv''\n- Chain Rule: dy/dx = dy/du × du/dx'
FROM diff_calculus_chapter
ON CONFLICT DO NOTHING;

-- 8. Insert sample question templates for common subjects
INSERT INTO question_templates (subject_id, template_name, question_format, options, is_active)
VALUES 
  ('bc7e6984-8a22-4869-b1d8-732009468abb', 'Physics MCQ (4 options)', 'single_choice', 
   '{"A": "", "B": "", "C": "", "D": ""}'::jsonb, true),
  ('4da2da37-aa0d-4c51-93b4-b8974f7b320d', 'Chemistry MCQ (4 options)', 'single_choice', 
   '{"A": "", "B": "", "C": "", "D": ""}'::jsonb, true),
  ('a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 'Mathematics MCQ (4 options)', 'single_choice', 
   '{"A": "", "B": "", "C": "", "D": ""}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- 9. Add trigger for updated_at on question_templates
CREATE OR REPLACE FUNCTION update_question_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_question_template_updated_at ON question_templates;
CREATE TRIGGER set_question_template_updated_at
    BEFORE UPDATE ON question_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_question_template_updated_at();