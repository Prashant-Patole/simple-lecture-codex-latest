
INSERT INTO categories (name, slug, description, level, display_order, is_active) VALUES
  ('Architecture', 'architecture', 'Architecture entrance exam preparation including NATA and JEE Paper 2', 1, 10, true),
  ('Research', 'research', 'Research methodology and academic research skills', 1, 11, true),
  ('Data Science', 'data-science', 'Data Science, Machine Learning and Analytics courses', 1, 12, true),
  ('Accounts', 'accounts', 'Accounting, Taxation and Financial Management courses', 1, 13, true),
  ('Business Studies', 'business-studies', 'Business Management, Marketing and Entrepreneurship', 1, 14, true),
  ('Economics', 'economics', 'Microeconomics, Macroeconomics and Indian Economy', 1, 15, true)
ON CONFLICT (slug) DO NOTHING;
