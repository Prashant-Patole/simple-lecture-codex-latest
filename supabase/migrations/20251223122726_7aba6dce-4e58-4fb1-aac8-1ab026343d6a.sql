-- Insert doubt logs with correct topics table references
INSERT INTO public.doubt_logs (student_id, question, answer, topic_id, response_time_ms, satisfaction_rating, created_at)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'How do I solve differential equations with boundary conditions?', 'To solve differential equations with boundary conditions, you need to first find the general solution and then apply the given conditions to find the particular constants.', '58adccb2-3a1d-4e57-bd47-e1e782386354', 2500, 5, now() - interval '1 day'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'What is the difference between ionic and covalent bonding?', 'Ionic bonding involves transfer of electrons while covalent bonding involves sharing of electrons between atoms.', 'aa61e3e9-f514-4997-a89f-018c916e815f', 1800, 4, now() - interval '3 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'Explain Ohm''s law in circuit analysis', 'Ohm''s law states that V = IR, where V is voltage, I is current, and R is resistance. It forms the foundation of circuit analysis.', 'ff03a0de-48c8-4878-9ff3-932976393810', 2100, 5, now() - interval '5 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'How to find integration by parts?', 'Integration by parts uses the formula: ∫udv = uv - ∫vdu. Choose u as the function that becomes simpler when differentiated.', '6ce48f42-dff3-4381-a171-e56c55fa35da', 1500, 4, now() - interval '7 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', 'What is electromagnetic induction?', 'Electromagnetic induction is the production of an electromotive force across a conductor when it is exposed to a changing magnetic field.', '7e4bf63a-adf9-4a71-84a7-df3b1a485576', 2000, 5, now() - interval '10 days');

-- Insert DPT submissions
INSERT INTO public.dpt_submissions (student_id, questions, answers, score, total_questions, time_taken_seconds, test_date, submitted_at)
VALUES 
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', '[]'::jsonb, '[]'::jsonb, 8, 10, 600, CURRENT_DATE - 1, now() - interval '1 day'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', '[]'::jsonb, '[]'::jsonb, 7, 10, 550, CURRENT_DATE - 3, now() - interval '3 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', '[]'::jsonb, '[]'::jsonb, 9, 10, 480, CURRENT_DATE - 5, now() - interval '5 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', '[]'::jsonb, '[]'::jsonb, 6, 10, 650, CURRENT_DATE - 8, now() - interval '8 days'),
  ('47a9b651-79d6-440b-a18c-9612ecf68b5a', '[]'::jsonb, '[]'::jsonb, 10, 10, 420, CURRENT_DATE - 12, now() - interval '12 days');