-- Recalculate and fix the score for the latest test result
-- Q4 is wrong (LaTeX mismatch) and Q8 is wrong (True vs False), so score should be 8/10
UPDATE paper_test_results 
SET score = 8, percentage = 80.00
WHERE id = 'ef6faf98-ce64-4fe7-b6b5-7aba77c7cc6f';