-- Phase 1: Database Schema Enhancements (Simplified - skip existing table)
-- Add new columns to subject_chapters table
ALTER TABLE subject_chapters 
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS video_platform TEXT,
  ADD COLUMN IF NOT EXISTS notes_markdown TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_video_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_podcast_url TEXT;

-- Add new columns to subject_topics table
ALTER TABLE subject_topics 
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS video_platform TEXT,
  ADD COLUMN IF NOT EXISTS notes_markdown TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_video_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_podcast_url TEXT,
  ADD COLUMN IF NOT EXISTS content_markdown TEXT;

-- Add new columns to subtopics table
ALTER TABLE subtopics 
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS video_platform TEXT,
  ADD COLUMN IF NOT EXISTS notes_markdown TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_video_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_podcast_url TEXT,
  ADD COLUMN IF NOT EXISTS content_markdown TEXT;

-- Insert sample chapters for Physics
INSERT INTO subject_chapters (subject_id, chapter_number, title, description, sequence_order)
VALUES 
  ('bc7e6984-8a22-4869-b1d8-732009468abb', 1, 'Electrostatics', 'Electric Charges and Fields, Coulomb''s Law, Electric Field and Potential', 1),
  ('bc7e6984-8a22-4869-b1d8-732009468abb', 2, 'Current Electricity', 'Ohm''s Law, Kirchhoff''s Laws, Resistors and Circuits', 2),
  ('bc7e6984-8a22-4869-b1d8-732009468abb', 3, 'Magnetism', 'Magnetic Field, Magnetic Force, Electromagnetic Induction', 3)
ON CONFLICT DO NOTHING;

-- Insert sample topics for Electrostatics chapter
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  sc.id,
  1,
  'Electric Charges',
  45,
  1,
  '# Electric Charges

- Properties of electric charges
- Conservation of charge
- Quantization of charge'
FROM subject_chapters sc
WHERE sc.subject_id = 'bc7e6984-8a22-4869-b1d8-732009468abb' AND sc.chapter_number = 1
ON CONFLICT DO NOTHING;

INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  sc.id,
  2,
  'Coulomb''s Law',
  60,
  2,
  '# Coulomb''s Law

- Force between two point charges
- Superposition principle
- Electric field intensity'
FROM subject_chapters sc
WHERE sc.subject_id = 'bc7e6984-8a22-4869-b1d8-732009468abb' AND sc.chapter_number = 1
ON CONFLICT DO NOTHING;

-- Insert sample chapters for Chemistry
INSERT INTO subject_chapters (subject_id, chapter_number, title, description, sequence_order)
VALUES 
  ('4da2da37-aa0d-4c51-93b4-b8974f7b320d', 1, 'Chemical Bonding', 'Ionic, Covalent, and Metallic Bonds, VSEPR Theory', 1),
  ('4da2da37-aa0d-4c51-93b4-b8974f7b320d', 2, 'Organic Chemistry Basics', 'Nomenclature, Isomerism, Reaction Mechanisms', 2)
ON CONFLICT DO NOTHING;

-- Insert sample topics for Chemical Bonding
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  sc.id,
  1,
  'Ionic Bonding',
  50,
  1,
  '# Ionic Bonding

- Formation of ionic compounds
- Lattice energy
- Properties of ionic compounds'
FROM subject_chapters sc
WHERE sc.subject_id = '4da2da37-aa0d-4c51-93b4-b8974f7b320d' AND sc.chapter_number = 1
ON CONFLICT DO NOTHING;

-- Insert sample chapters for Mathematics
INSERT INTO subject_chapters (subject_id, chapter_number, title, description, sequence_order)
VALUES 
  ('a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 1, 'Differential Calculus', 'Limits, Derivatives, Applications of Derivatives', 1),
  ('a4b75744-6fe8-4c9e-a87a-50cdf09842d9', 2, 'Integral Calculus', 'Integration Techniques, Definite and Indefinite Integrals', 2)
ON CONFLICT DO NOTHING;

-- Insert sample topics for Differential Calculus
INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  sc.id,
  1,
  'Limits and Continuity',
  55,
  1,
  '# Limits and Continuity

- Definition of limits
- Evaluation of limits
- Continuity of functions'
FROM subject_chapters sc
WHERE sc.subject_id = 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9' AND sc.chapter_number = 1
ON CONFLICT DO NOTHING;

INSERT INTO subject_topics (chapter_id, topic_number, title, estimated_duration_minutes, sequence_order, content_markdown)
SELECT 
  sc.id,
  2,
  'Differentiation',
  70,
  2,
  '# Differentiation

- Rules of differentiation
- Chain rule, product rule, quotient rule
- Implicit differentiation'
FROM subject_chapters sc
WHERE sc.subject_id = 'a4b75744-6fe8-4c9e-a87a-50cdf09842d9' AND sc.chapter_number = 1
ON CONFLICT DO NOTHING;