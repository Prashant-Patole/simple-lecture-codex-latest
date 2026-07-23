-- Enroll pramod0605@gmail.com in courses and create chapters

-- Create chapters for JEE Main Complete Course (526fede1-cbbd-43c6-ad99-5fa43d4034be)
INSERT INTO chapters (course_id, subject, title, chapter_number, description, sequence_order) VALUES
-- Physics chapters
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Mechanics - Kinematics', 1, 'Study of motion without considering forces', 1),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Mechanics - Laws of Motion', 2, 'Newton''s laws and applications', 2),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Work, Energy and Power', 3, 'Conservation of energy and work-energy theorem', 3),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Rotational Motion', 4, 'Angular motion and moment of inertia', 4),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Electrostatics', 5, 'Electric charge, field and potential', 5),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Current Electricity', 6, 'Ohm''s law and circuits', 6),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Electromagnetic Induction', 7, 'Faraday''s law and Lenz''s law', 7),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Physics', 'Optics', 8, 'Reflection, refraction and interference', 8),
-- Chemistry chapters
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Chemistry', 'Atomic Structure', 1, 'Bohr model and quantum numbers', 1),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Chemistry', 'Chemical Bonding', 2, 'Ionic, covalent and metallic bonds', 2),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Chemistry', 'Thermodynamics', 3, 'Laws of thermodynamics', 3),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Chemistry', 'Chemical Equilibrium', 4, 'Le Chatelier''s principle', 4),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Chemistry', 'Organic Chemistry Basics', 5, 'Hydrocarbons and functional groups', 5),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Chemistry', 'Periodic Table', 6, 'Periodic properties and trends', 6),
-- Mathematics chapters
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Complex Numbers', 1, 'Algebra of complex numbers', 1),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Quadratic Equations', 2, 'Solving and graphing quadratic equations', 2),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Limits and Continuity', 3, 'Fundamental concepts of calculus', 3),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Differentiation', 4, 'Derivatives and applications', 4),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Integration', 5, 'Indefinite and definite integrals', 5),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Coordinate Geometry', 6, 'Lines, circles and conic sections', 6),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Vectors', 7, 'Vector algebra and operations', 7),
('526fede1-cbbd-43c6-ad99-5fa43d4034be', 'Mathematics', 'Probability', 8, 'Basic probability and distributions', 8);

-- Create chapters for NEET Complete Course (39856fa3-ffd9-4178-af47-f5ae84773b21)
INSERT INTO chapters (course_id, subject, title, chapter_number, description, sequence_order) VALUES
-- Physics chapters
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Physical World and Measurement', 1, 'Units and dimensions', 1),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Kinematics', 2, 'Motion in one and two dimensions', 2),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Laws of Motion', 3, 'Newton''s laws and friction', 3),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Work Energy and Power', 4, 'Conservation principles', 4),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Thermodynamics', 5, 'Heat and temperature', 5),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Electrostatics', 6, 'Coulomb''s law and capacitance', 6),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Current Electricity', 7, 'Circuits and Kirchhoff''s laws', 7),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Physics', 'Optics', 8, 'Ray and wave optics', 8),
-- Chemistry chapters  
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Chemistry', 'Basic Chemistry', 1, 'Matter and its classification', 1),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Chemistry', 'Atomic Structure', 2, 'Electrons, protons and neutrons', 2),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Chemistry', 'Chemical Bonding', 3, 'Types of bonds', 3),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Chemistry', 'Thermodynamics', 4, 'Energy changes in reactions', 4),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Chemistry', 'Organic Chemistry', 5, 'Hydrocarbons basics', 5),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Chemistry', 'Biomolecules', 6, 'Carbohydrates, proteins and lipids', 6),
-- Biology chapters
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'The Living World', 1, 'Diversity in living organisms', 1),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'Cell: The Unit of Life', 2, 'Cell structure and organelles', 2),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'Cell Division', 3, 'Mitosis and meiosis', 3),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'Plant Physiology', 4, 'Photosynthesis and respiration', 4),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'Human Physiology - Digestion', 5, 'Digestive system', 5),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'Human Physiology - Circulation', 6, 'Circulatory system', 6),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'Genetics and Evolution', 7, 'Mendel''s laws and heredity', 7),
('39856fa3-ffd9-4178-af47-f5ae84773b21', 'Biology', 'Ecology and Environment', 8, 'Ecosystems and biodiversity', 8);

-- Create chapters for Class 12 Physics CBSE (9c34ee54-0bb8-44a6-bff0-c24047c49592)
INSERT INTO chapters (course_id, subject, title, chapter_number, description, sequence_order) VALUES
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Electric Charges and Fields', 1, 'Electrostatics fundamentals', 1),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Electrostatic Potential and Capacitance', 2, 'Potential energy and capacitors', 2),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Current Electricity', 3, 'Ohm''s law and circuits', 3),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Moving Charges and Magnetism', 4, 'Magnetic force and field', 4),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Electromagnetic Induction', 5, 'Faraday''s law', 5),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Alternating Current', 6, 'AC circuits and power', 6),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Ray Optics and Optical Instruments', 7, 'Mirrors, lenses and instruments', 7),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Wave Optics', 8, 'Interference and diffraction', 8),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Dual Nature of Radiation', 9, 'Photoelectric effect', 9),
('9c34ee54-0bb8-44a6-bff0-c24047c49592', 'Physics', 'Atoms and Nuclei', 10, 'Atomic models and nuclear physics', 10);

-- Create chapters for Class 12 Mathematics CBSE (40c1c705-802f-4c0f-8aa2-a3c7d8e45848)
INSERT INTO chapters (course_id, subject, title, chapter_number, description, sequence_order) VALUES
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Relations and Functions', 1, 'Types of relations and functions', 1),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Inverse Trigonometric Functions', 2, 'Inverse trig functions', 2),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Matrices', 3, 'Matrix operations', 3),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Determinants', 4, 'Determinant properties', 4),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Continuity and Differentiability', 5, 'Calculus fundamentals', 5),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Application of Derivatives', 6, 'Maxima, minima and optimization', 6),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Integrals', 7, 'Integration techniques', 7),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Application of Integrals', 8, 'Area under curves', 8),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Differential Equations', 9, 'First order DE', 9),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Vector Algebra', 10, 'Vector operations', 10),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Three Dimensional Geometry', 11, 'Lines and planes in 3D', 11),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Linear Programming', 12, 'Optimization problems', 12),
('40c1c705-802f-4c0f-8aa2-a3c7d8e45848', 'Mathematics', 'Probability', 13, 'Probability distributions', 13);

-- Enroll pramod0605@gmail.com (47a9b651-79d6-440b-a18c-9612ecf68b5a) in courses
INSERT INTO enrollments (student_id, course_id, enrolled_at, expires_at, is_active) VALUES
('47a9b651-79d6-440b-a18c-9612ecf68b5a', '526fede1-cbbd-43c6-ad99-5fa43d4034be', '2025-01-15 10:00:00+00', '2026-01-15 10:00:00+00', true),
('47a9b651-79d6-440b-a18c-9612ecf68b5a', '39856fa3-ffd9-4178-af47-f5ae84773b21', '2025-01-20 10:00:00+00', '2026-01-20 10:00:00+00', true),
('47a9b651-79d6-440b-a18c-9612ecf68b5a', '9c34ee54-0bb8-44a6-bff0-c24047c49592', '2025-02-01 10:00:00+00', '2025-08-01 10:00:00+00', true),
('47a9b651-79d6-440b-a18c-9612ecf68b5a', '40c1c705-802f-4c0f-8aa2-a3c7d8e45848', '2025-02-10 10:00:00+00', '2025-08-10 10:00:00+00', true)
ON CONFLICT DO NOTHING;