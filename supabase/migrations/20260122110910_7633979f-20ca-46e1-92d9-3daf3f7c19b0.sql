-- Create tests table for storing proficiency tests, exams, mock tests, etc.
CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES public.popular_subjects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.subject_chapters(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.subject_topics(id) ON DELETE SET NULL,
    duration_minutes INTEGER DEFAULT 30,
    total_marks INTEGER DEFAULT 0,
    test_type TEXT NOT NULL CHECK (test_type IN ('proficiency', 'practice', 'exam', 'mock')),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create test_questions junction table
CREATE TABLE public.test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL DEFAULT 1,
    marks INTEGER DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_id, question_id)
);

-- Enable RLS on both tables
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tests table
CREATE POLICY "Admins can manage tests"
    ON public.tests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Users can view active tests"
    ON public.tests FOR SELECT
    USING (is_active = true);

-- RLS Policies for test_questions table
CREATE POLICY "Admins can manage test questions"
    ON public.test_questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Users can view test questions for active tests"
    ON public.test_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tests 
            WHERE tests.id = test_questions.test_id 
            AND tests.is_active = true
        )
    );

-- Add indexes for performance
CREATE INDEX idx_tests_subject_id ON public.tests(subject_id);
CREATE INDEX idx_tests_chapter_id ON public.tests(chapter_id);
CREATE INDEX idx_tests_test_type ON public.tests(test_type);
CREATE INDEX idx_test_questions_test_id ON public.test_questions(test_id);
CREATE INDEX idx_test_questions_question_id ON public.test_questions(question_id);

-- Add trigger for updated_at on tests
CREATE TRIGGER update_tests_updated_at
    BEFORE UPDATE ON public.tests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();