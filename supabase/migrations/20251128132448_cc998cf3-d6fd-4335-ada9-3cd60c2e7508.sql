-- Add 10th/SSLC Board Subcategories (Level 3)
-- Parent: 10th/SSLC (ID: a6e8898a-3802-4b20-950f-21ee4e74a4dd)

INSERT INTO categories (name, slug, level, parent_id, icon, description, display_order, is_active, is_popular) VALUES
-- CBSE and ICSE Boards
('CBSE Board 10th', 'cbse-board-10th', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '📘', 'Complete preparation for CBSE Class 10 board examinations with NCERT curriculum', 1, true, true),
('ICSE Board 10th', 'icse-board-10th', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '📗', 'Comprehensive ICSE Class 10 board exam preparation following CISCE syllabus', 2, true, false),

-- State Boards
('Karnataka SSLC', 'karnataka-sslc', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '🏛️', 'Karnataka Secondary School Leaving Certificate exam preparation', 3, true, true),
('Maharashtra SSC', 'maharashtra-ssc', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '🏛️', 'Maharashtra State Board SSC (10th Standard) exam preparation', 4, true, false),
('Tamil Nadu SSLC', 'tamil-nadu-sslc', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '🏛️', 'Tamil Nadu State Board SSLC examination preparation', 5, true, false),
('Andhra Pradesh SSC', 'andhra-pradesh-ssc', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '🏛️', 'Andhra Pradesh Board of Secondary Education SSC exam prep', 6, true, false),
('Telangana SSC', 'telangana-ssc', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '🏛️', 'Telangana State Board SSC (10th Class) exam preparation', 7, true, false),
('Kerala SSLC', 'kerala-sslc', 3, 'a6e8898a-3802-4b20-950f-21ee4e74a4dd', '🏛️', 'Kerala Board SSLC examination complete preparation', 8, true, false);

-- Create Pharmacy Courses Parent Category (Level 1)
INSERT INTO categories (id, name, slug, level, parent_id, icon, description, display_order, is_active, is_popular) VALUES
('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Pharmacy Courses', 'pharmacy-courses', 1, NULL, '💊', 'Comprehensive pharmacy education programs including Diploma and Bachelor degrees', 7, true, true);

-- Add D.Pharm and B.Pharm Level 2 Categories
INSERT INTO categories (id, name, slug, level, parent_id, icon, description, display_order, is_active, is_popular) VALUES
('d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a', 'D.Pharm 1st Year', 'dpharm-1st-year', 2, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '📚', 'Diploma in Pharmacy First Year curriculum and subjects', 1, true, true),
('d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', 'D.Pharm 2nd Year', 'dpharm-2nd-year', 2, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '📚', 'Diploma in Pharmacy Second Year curriculum and subjects', 2, true, true),
('d3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a', 'B.Pharm', 'bpharm', 2, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '🎓', 'Bachelor of Pharmacy degree program courses', 3, true, false),
('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'Pharmacy Entrance', 'pharmacy-entrance', 2, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '🎯', 'Entrance exams for pharmacy college admissions', 4, true, false);

-- Add D.Pharm 1st Year Subject Categories (Level 3)
INSERT INTO categories (name, slug, level, parent_id, icon, description, display_order, is_active, is_popular) VALUES
('Pharmaceutics-I', 'pharmaceutics-i', 3, 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a', '⚗️', 'Introduction to pharmaceutical sciences, dosage forms and drug formulation', 1, true, false),
('Pharmaceutical Chemistry-I', 'pharmaceutical-chemistry-i', 3, 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a', '🧪', 'Inorganic pharmaceutical chemistry and analysis', 2, true, false),
('Pharmacognosy', 'pharmacognosy', 3, 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a', '🌿', 'Study of medicinal plants and natural products', 3, true, false),
('Human Anatomy & Physiology', 'human-anatomy-physiology', 3, 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a', '🫀', 'Structure and function of human body systems', 4, true, false),
('Health Education & Community Pharmacy', 'health-education-community-pharmacy', 3, 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a', '🏥', 'Community health and pharmaceutical care', 5, true, false);

-- Add D.Pharm 2nd Year Subject Categories (Level 3)
INSERT INTO categories (name, slug, level, parent_id, icon, description, display_order, is_active, is_popular) VALUES
('Pharmaceutics-II', 'pharmaceutics-ii', 3, 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', '⚗️', 'Advanced pharmaceutical technology and industrial pharmacy', 1, true, false),
('Pharmaceutical Chemistry-II', 'pharmaceutical-chemistry-ii', 3, 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', '🧪', 'Organic pharmaceutical chemistry and drug synthesis', 2, true, false),
('Pharmacology & Toxicology', 'pharmacology-toxicology', 3, 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', '💉', 'Drug action, therapeutic uses and toxicity management', 3, true, false),
('Pharmaceutical Jurisprudence', 'pharmaceutical-jurisprudence', 3, 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', '⚖️', 'Pharmacy laws, ethics and professional practice', 4, true, false),
('Drug Store & Business Management', 'drug-store-business-management', 3, 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', '💼', 'Pharmacy retail management and entrepreneurship', 5, true, false),
('Hospital & Clinical Pharmacy', 'hospital-clinical-pharmacy', 3, 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a', '🏥', 'Hospital pharmacy operations and clinical services', 6, true, false);