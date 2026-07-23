-- Phase 3: Update cart and order tables, remove program_id from courses

-- Step 3.1: Rename program_id to course_id in cart_items table
ALTER TABLE cart_items RENAME COLUMN program_id TO course_id;

-- Step 3.2: Drop old foreign key constraint and add new one for cart_items
ALTER TABLE cart_items 
  DROP CONSTRAINT IF EXISTS cart_items_program_id_fkey;

ALTER TABLE cart_items 
  ADD CONSTRAINT cart_items_course_id_fkey 
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

-- Step 3.3: Rename program_id to course_id in order_items table
ALTER TABLE order_items RENAME COLUMN program_id TO course_id;

-- Step 3.4: Drop old foreign key constraint and add new one for order_items
ALTER TABLE order_items 
  DROP CONSTRAINT IF EXISTS order_items_program_id_fkey;

ALTER TABLE order_items 
  ADD CONSTRAINT order_items_course_id_fkey 
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

-- Step 3.5: Drop program_id column from courses table completely
ALTER TABLE courses DROP COLUMN IF EXISTS program_id;