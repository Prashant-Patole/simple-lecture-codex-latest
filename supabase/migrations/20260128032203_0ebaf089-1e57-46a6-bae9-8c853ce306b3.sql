-- Add language top-up pricing columns to courses table
ALTER TABLE courses 
ADD COLUMN language_topup_price numeric DEFAULT 0,
ADD COLUMN language_topup_original_price numeric DEFAULT 0;