-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('technical', 'payment', 'account', 'course_access', 'certificate', 'feature_request', 'other')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ai_responded', 'user_confirmed_resolved', 'escalated_to_admin', 'admin_responded', 'closed_resolved', 'closed_redirected', 'closed_no_response')),
  ai_confidence NUMERIC(3,2),
  escalated_at TIMESTAMP WITH TIME ZONE,
  assigned_admin_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Create support_messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'ai', 'admin')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support_faqs table
CREATE TABLE public.support_faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('account', 'payment', 'technical', 'courses', 'certificates', 'general')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_faqs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users view own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own tickets"
  ON public.support_tickets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all tickets"
  ON public.support_tickets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for support_messages
CREATE POLICY "Users view own ticket messages"
  ON public.support_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users create messages on own tickets"
  ON public.support_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND user_id = auth.uid()
  ));

CREATE POLICY "Admins manage all messages"
  ON public.support_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for support_faqs
CREATE POLICY "Anyone can view active FAQs"
  ON public.support_faqs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage FAQs"
  ON public.support_faqs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX idx_support_faqs_category ON public.support_faqs(category);
CREATE INDEX idx_support_faqs_active ON public.support_faqs(is_active);

-- Create updated_at trigger for support_tickets
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for support_faqs
CREATE TRIGGER update_support_faqs_updated_at
  BEFORE UPDATE ON public.support_faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-populate FAQs
INSERT INTO public.support_faqs (category, question, answer, display_order) VALUES
-- Account FAQs
('account', 'How do I reset my password?', 'To reset your password:\n1. Go to the login page\n2. Click on "Forgot Password"\n3. Enter your registered email address\n4. Check your email for the reset link\n5. Click the link and create a new password\n\nIf you don''t receive the email within 5 minutes, please check your spam folder.', 1),
('account', 'How do I update my profile information?', 'To update your profile:\n1. Log in to your account\n2. Click on your profile icon in the top right corner\n3. Select "Profile" from the dropdown menu\n4. Edit your information (name, phone, avatar)\n5. Click "Save Changes"\n\nNote: Email address cannot be changed for security reasons.', 2),
('account', 'How do I change my email address?', 'For security reasons, email address changes require verification. Please contact our support team with:\n- Your current email\n- The new email you want to use\n- Reason for the change\n\nOur team will verify your identity and process the request within 24-48 hours.', 3),
('account', 'How do I delete my account?', 'To request account deletion:\n1. Go to Profile > Settings\n2. Scroll to "Account Management"\n3. Click "Delete Account"\n4. Confirm your decision\n\nNote: This action is irreversible and you will lose access to all purchased courses.', 4),

-- Payment FAQs
('payment', 'Why is my payment failing?', 'Common reasons for payment failure:\n1. **Insufficient funds** - Check your account balance\n2. **Card expired** - Update your card details\n3. **Wrong OTP** - Retry with correct OTP\n4. **Bank restrictions** - Contact your bank to enable online transactions\n5. **Network issues** - Try again with a stable connection\n\nIf the issue persists, try using a different payment method or contact your bank.', 1),
('payment', 'How do I get a refund?', 'Refund Policy:\n- Refund requests must be made within 7 days of purchase\n- Courses with less than 20% completion are eligible\n- Refunds are processed within 7-10 business days\n\nTo request a refund:\n1. Go to My Orders\n2. Select the order\n3. Click "Request Refund"\n4. Provide a reason\n\nOur team will review and respond within 48 hours.', 2),
('payment', 'Where can I find my invoice?', 'To download your invoice:\n1. Go to your Profile\n2. Click on "My Orders" or "Purchase History"\n3. Find the specific order\n4. Click "Download Invoice"\n\nInvoices are also sent to your registered email after each successful purchase.', 3),
('payment', 'What payment methods are accepted?', 'We accept the following payment methods:\n- **Credit/Debit Cards** (Visa, Mastercard, RuPay)\n- **UPI** (Google Pay, PhonePe, Paytm)\n- **Net Banking** (All major banks)\n- **Wallets** (Paytm, Mobikwik)\n\nAll payments are secured with 256-bit encryption.', 4),

-- Technical FAQs
('technical', 'Why can''t I watch videos?', 'If videos are not playing:\n1. **Check internet connection** - Minimum 2 Mbps required\n2. **Clear browser cache** - Press Ctrl+Shift+Delete\n3. **Try a different browser** - Chrome or Firefox recommended\n4. **Disable ad blockers** - They may interfere with video playback\n5. **Update browser** - Use the latest version\n\nFor mobile apps, try updating to the latest version.', 1),
('technical', 'The app is not loading. What should I do?', 'Try these troubleshooting steps:\n1. **Refresh the page** - Press F5 or Ctrl+R\n2. **Clear browser cache and cookies**\n3. **Check internet connection**\n4. **Disable browser extensions**\n5. **Try incognito/private mode**\n6. **Update your browser**\n\nIf the issue persists, please contact support with:\n- Browser name and version\n- Error message (if any)\n- Screenshot of the issue', 2),
('technical', 'How do I clear my cache?', 'To clear cache:\n\n**Chrome:**\n1. Press Ctrl+Shift+Delete\n2. Select "All time" as time range\n3. Check "Cached images and files"\n4. Click "Clear data"\n\n**Firefox:**\n1. Press Ctrl+Shift+Delete\n2. Select "Everything" as time range\n3. Check "Cache"\n4. Click "Clear Now"\n\n**Mobile App:**\nGo to Settings > Storage > Clear Cache', 3),

-- Courses FAQs
('courses', 'How do I access my purchased course?', 'To access your course:\n1. Log in to your account\n2. Go to "My Courses" from the navigation menu\n3. Find your course in the list\n4. Click on the course card to start learning\n\nIf you don''t see your course after purchase, wait 5 minutes and refresh the page. If it still doesn''t appear, contact support with your payment confirmation.', 1),
('courses', 'Why is my course showing as locked?', 'Courses may appear locked due to:\n1. **Payment not completed** - Check your payment status\n2. **Subscription expired** - Renew your subscription\n3. **Course prerequisites** - Complete required courses first\n4. **Technical glitch** - Log out and log back in\n\nIf none of these apply, please contact support with your order details.', 2),
('courses', 'How do I track my progress?', 'To track your progress:\n1. Go to "My Courses"\n2. Each course card shows a progress bar\n3. Click on a course to see detailed progress\n4. View chapter-wise completion status\n5. Check your activity dashboard for learning streaks\n\nProgress is automatically saved as you complete lessons and quizzes.', 3),
('courses', 'Can I download course content for offline viewing?', 'Yes! To download content:\n1. Go to the course you want to download\n2. Look for the download icon next to each video\n3. Click to download for offline viewing\n\nNote: Downloaded content is only available in our mobile app and expires after 30 days for security reasons.', 4),

-- Certificate FAQs
('certificates', 'How do I download my certificate?', 'To download your certificate:\n1. Complete 100% of the course content\n2. Pass all required quizzes with minimum score\n3. Go to "My Courses"\n4. Click on the completed course\n5. Look for "Download Certificate" button\n6. Choose PDF or image format\n\nCertificates are generated within 24 hours of course completion.', 1),
('certificates', 'My certificate has the wrong name. How do I fix it?', 'Certificate names are taken from your profile. To correct it:\n1. Go to Profile > Edit Profile\n2. Update your full name\n3. Save changes\n4. Contact support to regenerate your certificate\n\nPlease provide:\n- Course name\n- Correct name spelling\n- Order ID\n\nWe''ll issue a corrected certificate within 48 hours.', 2),
('certificates', 'Are your certificates valid for jobs?', 'Yes! Our certificates are:\n- Verified with unique certificate ID\n- QR code enabled for authenticity check\n- Recognized by 500+ hiring partners\n- Shareable on LinkedIn\n\nEmployers can verify certificates on our website using the certificate ID.', 3),

-- General FAQs
('general', 'How do I contact customer support?', 'You can reach us through:\n1. **This Help Center** - Chat with our AI assistant\n2. **Email** - support@simplelecture.com\n3. **Phone** - +91 (323) 555-9876 (Mon-Sat, 9 AM - 6 PM)\n4. **Social Media** - DM us on Twitter/Instagram\n\nFor urgent issues, use the chat feature for fastest response.', 1),
('general', 'What are your operating hours?', 'Our support team is available:\n- **AI Assistant**: 24/7\n- **Email Support**: Responses within 24 hours\n- **Phone Support**: Monday to Saturday, 9 AM - 6 PM IST\n- **Live Chat**: Monday to Friday, 10 AM - 5 PM IST', 2),
('general', 'Is there a mobile app available?', 'Yes! Our mobile app is available on:\n- **Android**: Download from Google Play Store\n- **iOS**: Download from Apple App Store\n\nSearch for "SimpleLecture" and look for our official logo. The app offers:\n- Offline video downloads\n- Push notifications for classes\n- Progress sync across devices', 3);