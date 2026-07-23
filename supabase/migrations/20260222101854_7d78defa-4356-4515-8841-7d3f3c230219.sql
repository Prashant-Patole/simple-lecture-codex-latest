
INSERT INTO popular_subjects (name, slug, description, display_order, is_active, category_id) VALUES
  -- Engineering (reuse existing, just add Engineering Drawing)
  ('Engineering Drawing', 'engineering-drawing', 'Technical drawing, projections, and engineering graphics fundamentals', 10, true, 'e66b13f5-5cb1-43c3-81ce-acfeb7af16d7'),
  -- Architecture
  ('Design & Drawing', 'design-drawing', 'Architectural design principles, sketching, and technical drawing', 11, true, '7550f43b-0cc0-4c94-92db-d9b92d4b5620'),
  ('Aesthetic Sensitivity', 'aesthetic-sensitivity', 'Colour theory, visual perception, texture, and design aesthetics', 12, true, '7550f43b-0cc0-4c94-92db-d9b92d4b5620'),
  -- Research
  ('Research Methodology', 'research-methodology', 'Research design, sampling methods, and scientific inquiry', 13, true, '487ee33f-c8b6-4444-abd8-943afecb63bc'),
  ('Statistics', 'statistics', 'Descriptive and inferential statistics for research and analysis', 14, true, '487ee33f-c8b6-4444-abd8-943afecb63bc'),
  ('Academic Writing', 'academic-writing', 'Research papers, thesis writing, citations, and scholarly communication', 15, true, '487ee33f-c8b6-4444-abd8-943afecb63bc'),
  ('Data Analysis', 'data-analysis', 'Quantitative and qualitative data analysis techniques', 16, true, '487ee33f-c8b6-4444-abd8-943afecb63bc'),
  -- Data Science
  ('Python Programming', 'python-programming', 'Python language fundamentals, libraries, and data manipulation', 17, true, 'afa01e25-58fe-4dd6-985f-4ae347fc5e04'),
  ('Statistics & Probability', 'statistics-probability', 'Probability theory, distributions, hypothesis testing, and regression', 18, true, 'afa01e25-58fe-4dd6-985f-4ae347fc5e04'),
  ('Machine Learning', 'machine-learning', 'Supervised, unsupervised learning, neural networks, and model evaluation', 19, true, 'afa01e25-58fe-4dd6-985f-4ae347fc5e04'),
  ('Data Visualization', 'data-visualization', 'Charts, dashboards, and visual storytelling with data', 20, true, 'afa01e25-58fe-4dd6-985f-4ae347fc5e04'),
  ('SQL & Databases', 'sql-databases', 'Relational databases, SQL queries, joins, and database design', 21, true, 'afa01e25-58fe-4dd6-985f-4ae347fc5e04'),
  -- Accounts
  ('Financial Accounting', 'financial-accounting', 'Journal entries, ledgers, trial balance, financial statements', 22, true, '3f9bff86-dfc4-4f89-be23-563d270f7efa'),
  ('Cost Accounting', 'cost-accounting', 'Cost classification, budgeting, variance analysis, and marginal costing', 23, true, '3f9bff86-dfc4-4f89-be23-563d270f7efa'),
  ('Taxation', 'taxation', 'Income tax, GST, tax planning, and compliance', 24, true, '3f9bff86-dfc4-4f89-be23-563d270f7efa'),
  ('Auditing', 'auditing', 'Auditing principles, internal controls, and audit procedures', 25, true, '3f9bff86-dfc4-4f89-be23-563d270f7efa'),
  -- Business Studies
  ('Management Principles', 'management-principles', 'Planning, organising, staffing, directing, and controlling', 26, true, '61840968-cc7f-4d74-93e1-05f475dc9bc6'),
  ('Marketing', 'marketing', 'Marketing mix, consumer behaviour, branding, and digital marketing', 27, true, '61840968-cc7f-4d74-93e1-05f475dc9bc6'),
  ('Finance & Trade', 'finance-trade', 'International trade, banking, insurance, and financial markets', 28, true, '61840968-cc7f-4d74-93e1-05f475dc9bc6'),
  ('Entrepreneurship', 'entrepreneurship', 'Business planning, startups, innovation, and venture management', 29, true, '61840968-cc7f-4d74-93e1-05f475dc9bc6'),
  -- Economics
  ('Microeconomics', 'microeconomics', 'Demand, supply, market structures, and consumer theory', 30, true, '44f64ef3-6608-49e6-98d8-6561af04386e'),
  ('Macroeconomics', 'macroeconomics', 'National income, money supply, fiscal and monetary policy', 31, true, '44f64ef3-6608-49e6-98d8-6561af04386e'),
  ('Indian Economy', 'indian-economy', 'Economic reforms, poverty, infrastructure, and sustainable development', 32, true, '44f64ef3-6608-49e6-98d8-6561af04386e'),
  ('Statistics for Economics', 'statistics-for-economics', 'Index numbers, measures of central tendency, and data collection', 33, true, '44f64ef3-6608-49e6-98d8-6561af04386e')
ON CONFLICT (slug) DO NOTHING;
