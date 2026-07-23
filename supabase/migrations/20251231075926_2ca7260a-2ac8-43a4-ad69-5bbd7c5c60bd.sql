-- Create support_articles table
CREATE TABLE public.support_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  icon_name TEXT DEFAULT 'BookOpen',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create support_article_feedback table
CREATE TABLE public.support_article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.support_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, user_id)
);

-- Enable RLS
ALTER TABLE public.support_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_article_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_articles
CREATE POLICY "Anyone can view active articles"
ON public.support_articles FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins manage articles"
ON public.support_articles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for support_article_feedback
CREATE POLICY "Users can view own feedback"
ON public.support_article_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
ON public.support_article_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
ON public.support_article_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
ON public.support_article_feedback FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all feedback"
ON public.support_article_feedback FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_support_articles_updated_at
BEFORE UPDATE ON public.support_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial articles
INSERT INTO public.support_articles (slug, title, description, content, icon_name, display_order) VALUES
('getting-started', 'Getting Started', 'Learn how to create your account and navigate the SimpleLecture platform', E'## Welcome to SimpleLecture!\n\nThis guide will help you get started with your learning journey.\n\n### Creating Your Account\n\n1. **Visit the Homepage** - Go to SimpleLecture.com\n2. **Click Sign Up** - Find the "Sign Up" button in the top right corner\n3. **Enter Your Details**:\n   - Full Name\n   - Email Address\n   - Phone Number\n   - Create a secure password\n4. **Verify Your Email** - Check your inbox for a verification link\n5. **Complete Your Profile** - Add additional details like date of birth\n\n### Exploring Courses\n\n1. **Browse Categories** - Use the navigation menu to explore different course categories\n2. **Search Courses** - Use the search bar to find specific courses\n3. **View Course Details** - Click on any course to see curriculum, pricing, and reviews\n4. **Add to Cart** - Click "Add to Cart" to save courses for purchase\n\n### Your Dashboard\n\nAfter logging in, you''ll have access to:\n- **My Courses** - All your enrolled courses\n- **Progress Tracking** - See your learning progress\n- **Upcoming Classes** - View scheduled live sessions\n- **Notifications** - Important updates and reminders', 'BookOpen', 1),

('course-navigation', 'Course Navigation', 'Understanding how to navigate through your enrolled courses and access all learning materials', E'## Navigating Your Courses\n\nOnce enrolled, here''s how to make the most of your learning experience.\n\n### The Learning Page Layout\n\n1. **Subject Navigation Bar** - Switch between different subjects in your course\n2. **Chapters Sidebar** - Browse all chapters and topics\n3. **Content Area** - Main viewing area for videos, notes, and materials\n\n### Available Learning Tabs\n\n- **Classes** - Watch recorded lectures and join live sessions\n- **AI Assistant** - Get instant help with your doubts\n- **Podcast** - Listen to audio lessons on the go\n- **MCQs** - Practice with multiple choice questions\n- **DPT** - Daily Practice Tests to track your progress\n- **Notes** - Access downloadable study materials\n- **Assignments** - Complete and submit your homework\n- **Previous Year Papers** - Practice with past exam questions\n\n### Tracking Your Progress\n\n- Green checkmarks indicate completed topics\n- Progress bars show chapter completion percentage\n- Dashboard shows overall course progress', 'GraduationCap', 2),

('account-settings', 'Account Settings', 'Manage your profile, preferences, and security settings', E'## Managing Your Account\n\nKeep your account information up to date and secure.\n\n### Accessing Profile Settings\n\n1. Click on your profile picture in the top right\n2. Select "Profile" from the dropdown menu\n3. Or navigate directly to /profile\n\n### Updating Your Information\n\n**Personal Details:**\n- Full Name\n- Phone Number\n- Date of Birth\n- Profile Picture\n\n**Student ID Card:**\n- View your digital student ID\n- Download for offline use\n\n### Notification Preferences\n\nCustomize what notifications you receive:\n- Email notifications for new classes\n- Push notifications for assignments\n- Reminder notifications for tests\n\n### Security Settings\n\n- Change your password regularly\n- Enable two-factor authentication\n- Review login history', 'Settings', 3),

('payment-billing', 'Payment & Billing', 'Everything about payments, invoices, and subscription management', E'## Payment & Billing Guide\n\n### Making a Purchase\n\n1. **Add Courses to Cart** - Browse and add desired courses\n2. **Review Cart** - Check your selections at /cart\n3. **Apply Promo Code** - Enter any discount codes\n4. **Proceed to Checkout** - Click the checkout button\n5. **Complete Payment** - Pay securely via Razorpay\n\n### Payment Methods Accepted\n\n- Credit/Debit Cards\n- UPI (Google Pay, PhonePe, Paytm)\n- Net Banking\n- Wallets\n\n### Viewing Payment History\n\n1. Go to your Profile page\n2. Navigate to "Payment History" section\n3. View all past transactions\n4. Download invoices as needed\n\n### Payment Issues\n\nIf your payment fails:\n1. Check your bank balance\n2. Ensure card details are correct\n3. Try a different payment method\n4. Contact support if issues persist\n\n### Refund Policy\n\n- Refund requests within 7 days of purchase\n- Contact support with order details\n- Refunds processed within 5-7 business days', 'CreditCard', 4),

('certificates-progress', 'Certificates & Progress', 'Track your learning journey and earn certificates', E'## Certificates & Progress Tracking\n\n### Your Student Dashboard\n\nAccess comprehensive learning analytics at /student-dashboard\n\n**Overview Tab:**\n- Quick stats on your learning\n- Recent activity summary\n- Upcoming deadlines\n\n**My Progress Tab:**\n- Detailed progress for each course\n- Topic-wise completion status\n- Time spent learning\n\n**My Tests Tab:**\n- Quiz and test scores\n- Performance trends\n- Comparative analysis\n\n**My Attendance Tab:**\n- Live class attendance records\n- Attendance percentage\n- Missed class recordings\n\n### Earning Certificates\n\n1. **Complete Course Requirements**\n   - Watch all video lectures\n   - Complete minimum required assignments\n   - Pass the final assessment\n\n2. **Download Certificate**\n   - Go to your completed course\n   - Click "Download Certificate"\n   - Share on LinkedIn or print\n\n### Certificate Verification\n\nAll certificates include:\n- Unique certificate ID\n- QR code for verification\n- Course completion date', 'Shield', 5),

('technical-support', 'Technical Support', 'Troubleshooting common issues and getting help', E'## Technical Support Guide\n\n### Common Video Issues\n\n**Video not playing:**\n1. Check your internet connection\n2. Try refreshing the page\n3. Clear browser cache\n4. Try a different browser\n\n**Video buffering:**\n1. Lower the video quality\n2. Pause and let it buffer\n3. Check other devices on your network\n\n### Login Issues\n\n**Forgot Password:**\n1. Click "Forgot Password" on login page\n2. Enter your registered email\n3. Check inbox for reset link\n4. Create a new password\n\n**Account Locked:**\n- Wait 30 minutes and try again\n- Or contact support for immediate help\n\n### Browser Compatibility\n\n**Recommended Browsers:**\n- Google Chrome (latest)\n- Mozilla Firefox (latest)\n- Safari (latest)\n- Microsoft Edge (latest)\n\n### Mobile App\n\nAvailable on:\n- iOS (App Store)\n- Android (Play Store)\n\n### Clearing Cache & Cookies\n\n**Chrome:**\n1. Press Ctrl + Shift + Delete\n2. Select "All time"\n3. Check "Cookies" and "Cached images"\n4. Click "Clear data"\n\n### Still Need Help?\n\nIf your issue isn''t resolved:\n1. Use the AI Support Chat below\n2. Create a support ticket\n3. Email: support@simplelecture.com', 'Wrench', 6);