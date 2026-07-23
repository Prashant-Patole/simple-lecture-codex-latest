import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEO/SEOHead";
import { BottomNav } from "@/components/mobile/BottomNav";
import { Shield, Database, Eye, Share2, Lock, Cookie, Users, Clock, UserCheck, RefreshCw, Mail } from "lucide-react";

const PrivacyPolicy = () => {
  const sections = [
    { id: "information-collect", title: "1. Information We Collect", icon: Database },
    { id: "how-we-use", title: "2. How We Use Your Information", icon: Eye },
    { id: "information-sharing", title: "3. Information Sharing", icon: Share2 },
    { id: "data-security", title: "4. Data Security", icon: Lock },
    { id: "cookies", title: "5. Cookies & Tracking", icon: Cookie },
    { id: "third-party", title: "6. Third-Party Services", icon: Users },
    { id: "children", title: "7. Children's Privacy", icon: UserCheck },
    { id: "data-retention", title: "8. Data Retention", icon: Clock },
    { id: "your-rights", title: "9. Your Rights", icon: Shield },
    { id: "changes", title: "10. Changes to Policy", icon: RefreshCw },
    { id: "contact", title: "11. Contact Information", icon: Mail },
  ];

  return (
    <>
      <SEOHead
        title="Privacy Policy"
        description="Privacy Policy for SimpleLecture - Learn how KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC) protects your personal information"
        keywords="privacy, policy, data protection, SimpleLecture, KRUPA KNOWLEDGE STORE"
        canonicalUrl="https://simplelecture.com/privacy"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://simplelecture.com" },
            { "@type": "ListItem", "position": 2, "name": "Privacy Policy", "item": "https://simplelecture.com/privacy" }
          ]
        }}
      />
      <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
        <Header />
        
        <main className="flex-1">
          {/* Hero Section */}
          <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
                <p className="text-lg text-muted-foreground mb-2">
                  <strong>KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC)</strong>
                </p>
                <p className="text-muted-foreground">
                  Operating as <strong>SimpleLecture</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Last Updated: February 6, 2025
                </p>
              </div>
            </div>
          </section>

          {/* Content Section */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                {/* Table of Contents */}
                <div className="bg-card rounded-xl border p-6 mb-8">
                  <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
                  <nav className="grid md:grid-cols-2 gap-2">
                    {sections.map((section) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                      >
                        <section.icon className="w-4 h-4" />
                        {section.title}
                      </a>
                    ))}
                  </nav>
                </div>

                {/* Privacy Content */}
                <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
                  <p className="text-muted-foreground">
                    This Privacy Policy describes how <strong>KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC)</strong> 
                    ("Company", "we", "us", or "our"), operating as SimpleLecture, collects, uses, and protects 
                    your personal information when you use our platform, website, mobile applications, and services 
                    (collectively, the "Services").
                  </p>
                  <p className="text-muted-foreground">
                    We are committed to protecting your privacy and ensuring compliance with applicable Indian data 
                    protection laws and regulations.
                  </p>

                  <section id="information-collect" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Database className="w-6 h-6 text-primary" />
                      1. Information We Collect
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p><strong>Information You Provide:</strong></p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Account information (name, email address, phone number, password)</li>
                        <li>Profile information (profile picture, educational background)</li>
                        <li>Payment information (processed securely through payment gateways)</li>
                        <li>Communication preferences and support inquiries</li>
                        <li>Course progress, quiz answers, and learning data</li>
                        <li>Forum posts, comments, and other user-generated content</li>
                      </ul>
                      <p><strong>Information Collected Automatically:</strong></p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Device information (device type, operating system, browser type)</li>
                        <li>Usage data (pages visited, time spent, features used)</li>
                        <li>IP address and approximate location</li>
                        <li>Cookies and similar tracking technologies</li>
                        <li>Log data and error reports</li>
                      </ul>
                    </div>
                  </section>

                  <section id="how-we-use" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Eye className="w-6 h-6 text-primary" />
                      2. How We Use Your Information
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>We use your information to:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Provide, maintain, and improve our Services</li>
                        <li>Process transactions and send related information</li>
                        <li>Personalize your learning experience</li>
                        <li>Track your course progress and provide recommendations</li>
                        <li>Send notifications, updates, and promotional communications</li>
                        <li>Respond to your inquiries and provide customer support</li>
                        <li>Detect, prevent, and address technical issues and fraud</li>
                        <li>Comply with legal obligations</li>
                        <li>Analyze usage patterns to improve our platform</li>
                      </ul>
                    </div>
                  </section>

                  <section id="information-sharing" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Share2 className="w-6 h-6 text-primary" />
                      3. Information Sharing
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>We may share your information with:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Service Providers:</strong> Third-party companies that help us operate our Services (payment processors, cloud hosting, analytics)</li>
                        <li><strong>Instructors:</strong> Course instructors may see your progress and engagement data for their courses</li>
                        <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
                        <li><strong>Business Transfers:</strong> In connection with any merger, acquisition, or sale of company assets</li>
                        <li><strong>With Your Consent:</strong> When you give us explicit permission</li>
                      </ul>
                      <p>
                        We do not sell your personal information to third parties for marketing purposes.
                      </p>
                    </div>
                  </section>

                  <section id="data-security" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Lock className="w-6 h-6 text-primary" />
                      4. Data Security
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        We implement appropriate technical and organizational security measures to protect your 
                        personal information, including:
                      </p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Encryption of data in transit and at rest</li>
                        <li>Secure authentication mechanisms</li>
                        <li>Regular security assessments and audits</li>
                        <li>Access controls and employee training</li>
                        <li>Secure data centers and infrastructure</li>
                      </ul>
                      <p>
                        While we strive to protect your information, no method of transmission over the Internet 
                        or electronic storage is 100% secure. We cannot guarantee absolute security.
                      </p>
                    </div>
                  </section>

                  <section id="cookies" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Cookie className="w-6 h-6 text-primary" />
                      5. Cookies & Tracking
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>We use cookies and similar technologies to:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Keep you logged in and remember your preferences</li>
                        <li>Understand how you use our Services</li>
                        <li>Personalize your experience</li>
                        <li>Analyze traffic and improve our platform</li>
                        <li>Deliver relevant advertisements</li>
                      </ul>
                      <p>
                        You can control cookies through your browser settings. However, disabling cookies may 
                        affect the functionality of our Services.
                      </p>
                    </div>
                  </section>

                  <section id="third-party" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Users className="w-6 h-6 text-primary" />
                      6. Third-Party Services
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        Our Services may contain links to third-party websites or integrate with third-party services. 
                        We are not responsible for the privacy practices of these third parties. We encourage you to 
                        review their privacy policies.
                      </p>
                      <p>Third-party services we use include:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Payment processors (Razorpay, PhonePe)</li>
                        <li>Analytics services (Google Analytics)</li>
                        <li>Cloud infrastructure providers</li>
                        <li>Communication services (email, SMS)</li>
                      </ul>
                    </div>
                  </section>

                  <section id="children" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <UserCheck className="w-6 h-6 text-primary" />
                      7. Children's Privacy
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        Our Services are intended for users aged 13 and above. Users under 18 must have parental 
                        or guardian consent. We do not knowingly collect personal information from children under 
                        13 without parental consent.
                      </p>
                      <p>
                        If you believe we have collected information from a child under 13 without proper consent, 
                        please contact us immediately, and we will take steps to delete such information.
                      </p>
                    </div>
                  </section>

                  <section id="data-retention" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Clock className="w-6 h-6 text-primary" />
                      8. Data Retention
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        We retain your personal information for as long as necessary to fulfill the purposes 
                        outlined in this Privacy Policy, unless a longer retention period is required or permitted 
                        by law.
                      </p>
                      <p>
                        When you delete your account, we will delete or anonymize your personal information within 
                        a reasonable timeframe, except where we are required to retain it for legal, regulatory, 
                        or legitimate business purposes.
                      </p>
                    </div>
                  </section>

                  <section id="your-rights" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Shield className="w-6 h-6 text-primary" />
                      9. Your Rights
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>You have the right to:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Access:</strong> Request a copy of your personal information</li>
                        <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                        <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                        <li><strong>Portability:</strong> Request your data in a portable format</li>
                        <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                        <li><strong>Withdraw Consent:</strong> Where processing is based on consent</li>
                      </ul>
                      <p>
                        To exercise these rights, please contact us using the information provided below. We will 
                        respond to your request within a reasonable timeframe.
                      </p>
                    </div>
                  </section>

                  <section id="changes" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <RefreshCw className="w-6 h-6 text-primary" />
                      10. Changes to Policy
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        We may update this Privacy Policy from time to time. We will notify you of any changes by 
                        posting the new Privacy Policy on this page and updating the "Last Updated" date.
                      </p>
                      <p>
                        For significant changes, we may also send you a notification via email or through our 
                        platform. Your continued use of our Services after any changes constitutes your acceptance 
                        of the new Privacy Policy.
                      </p>
                    </div>
                  </section>

                  <section id="contact" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Mail className="w-6 h-6 text-primary" />
                      11. Contact Information
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        If you have any questions about this Privacy Policy or our data practices, please contact us:
                      </p>
                      <div className="bg-card rounded-lg border p-6">
                        <p className="font-semibold">KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC)</p>
                        <p>Operating as SimpleLecture</p>
                        <p className="mt-4">
                          <strong>Data Protection Officer:</strong> privacy@simplelecture.com
                        </p>
                        <p>
                          <strong>Email:</strong> contact@simplelecture.com
                        </p>
                        <p>
                          <strong>Phone:</strong> +91 73530 21234
                        </p>
                        <p>
                          <strong>Address:</strong> Koramangala, Bangalore, Karnataka, India
                        </p>
                      </div>
                      <p className="mt-4">
                        For more information about how we handle your data, please also review our{" "}
                        <a href="/terms" className="text-primary hover:underline">Terms & Conditions</a>.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer />
        <BottomNav />
      </div>
    </>
  );
};

export default PrivacyPolicy;
