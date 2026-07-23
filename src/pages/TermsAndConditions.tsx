import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEO/SEOHead";
import { BottomNav } from "@/components/mobile/BottomNav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Scale, Users, CreditCard, Shield, BookOpen, AlertTriangle, XCircle, Gavel, Mail } from "lucide-react";

const TermsAndConditions = () => {
  const sections = [
    { id: "acceptance", title: "1. Acceptance of Terms", icon: FileText },
    { id: "accounts", title: "2. User Accounts & Registration", icon: Users },
    { id: "course-access", title: "3. Course Access & Usage", icon: BookOpen },
    { id: "payment", title: "4. Payment Terms", icon: CreditCard },
    { id: "intellectual-property", title: "5. Intellectual Property", icon: Shield },
    { id: "user-conduct", title: "6. User Conduct", icon: Scale },
    { id: "privacy", title: "7. Privacy", icon: Shield },
    { id: "disclaimers", title: "8. Disclaimers & Limitations", icon: AlertTriangle },
    { id: "termination", title: "9. Termination", icon: XCircle },
    { id: "governing-law", title: "10. Governing Law", icon: Gavel },
    { id: "contact", title: "11. Contact Information", icon: Mail },
  ];

  return (
    <>
      <SEOHead
        title="Terms & Conditions"
        description="Terms and Conditions for using SimpleLecture - India's AI-powered learning platform by KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC)"
        keywords="terms, conditions, legal, SimpleLecture, KRUPA KNOWLEDGE STORE"
        canonicalUrl="https://simplelecture.com/terms"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://simplelecture.com" },
            { "@type": "ListItem", "position": 2, "name": "Terms & Conditions", "item": "https://simplelecture.com/terms" }
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
                  <Scale className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms & Conditions</h1>
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

                {/* Terms Content */}
                <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
                  <p className="text-muted-foreground">
                    Welcome to SimpleLecture. These Terms and Conditions ("Terms") govern your use of the SimpleLecture 
                    platform, website, mobile applications, and services (collectively, the "Services") provided by 
                    <strong> KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC)</strong> ("Company", "we", "us", or "our"), 
                    a company registered under the laws of India.
                  </p>

                  <section id="acceptance" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <FileText className="w-6 h-6 text-primary" />
                      1. Acceptance of Terms
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        By accessing or using our Services, you agree to be bound by these Terms. If you do not agree 
                        to these Terms, please do not use our Services.
                      </p>
                      <p>
                        We reserve the right to modify these Terms at any time. We will notify you of any changes by 
                        posting the new Terms on this page and updating the "Last Updated" date. Your continued use 
                        of the Services after any changes constitutes your acceptance of the new Terms.
                      </p>
                    </div>
                  </section>

                  <section id="accounts" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Users className="w-6 h-6 text-primary" />
                      2. User Accounts & Registration
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>To access certain features of our Services, you must create an account. You agree to:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Provide accurate, current, and complete information during registration</li>
                        <li>Maintain and promptly update your account information</li>
                        <li>Keep your password secure and confidential</li>
                        <li>Notify us immediately of any unauthorized access to your account</li>
                        <li>Be responsible for all activities that occur under your account</li>
                      </ul>
                      <p>
                        You must be at least 13 years old to create an account. If you are under 18, you must have 
                        parental or guardian consent to use our Services.
                      </p>
                    </div>
                  </section>

                  <section id="course-access" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <BookOpen className="w-6 h-6 text-primary" />
                      3. Course Access & Usage
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>When you purchase a course, you receive a limited, non-exclusive, non-transferable license to:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Access and view the course content for personal, non-commercial purposes</li>
                        <li>Use course materials for your own learning and education</li>
                        <li>Access the course for the duration specified at the time of purchase</li>
                      </ul>
                      <p>You may not:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Share your account credentials with others</li>
                        <li>Copy, reproduce, distribute, or publicly display course content</li>
                        <li>Download course videos unless explicitly permitted</li>
                        <li>Use course content for commercial purposes</li>
                        <li>Attempt to circumvent any access controls or security measures</li>
                      </ul>
                    </div>
                  </section>

                  <section id="payment" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <CreditCard className="w-6 h-6 text-primary" />
                      4. Payment Terms
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        All prices are displayed in Indian Rupees (INR) unless otherwise specified. Payment must be 
                        made at the time of purchase through our approved payment methods.
                      </p>
                      <p><strong>Refund Policy:</strong></p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Refund requests must be made within 7 days of purchase</li>
                        <li>Refunds are subject to our review and approval</li>
                        <li>Courses that have been substantially accessed may not be eligible for refunds</li>
                        <li>Processing fees may be deducted from refund amounts</li>
                      </ul>
                      <p>
                        We reserve the right to modify pricing at any time. Existing purchases will not be affected 
                        by price changes.
                      </p>
                    </div>
                  </section>

                  <section id="intellectual-property" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Shield className="w-6 h-6 text-primary" />
                      5. Intellectual Property
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        All content on SimpleLecture, including but not limited to courses, videos, text, graphics, 
                        logos, images, audio, and software, is the property of KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC) 
                        or its content suppliers and is protected by Indian and international copyright, trademark, 
                        and other intellectual property laws.
                      </p>
                      <p>
                        The SimpleLecture name, logo, and all related names, logos, product and service names, designs, 
                        and slogans are trademarks of KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC). You may not use 
                        these marks without our prior written permission.
                      </p>
                    </div>
                  </section>

                  <section id="user-conduct" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Scale className="w-6 h-6 text-primary" />
                      6. User Conduct
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>You agree not to:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Use the Services for any unlawful purpose</li>
                        <li>Harass, abuse, or harm other users</li>
                        <li>Post or transmit harmful, offensive, or inappropriate content</li>
                        <li>Impersonate any person or entity</li>
                        <li>Interfere with or disrupt the Services or servers</li>
                        <li>Attempt to gain unauthorized access to any part of the Services</li>
                        <li>Use automated systems or software to extract data from the Services</li>
                        <li>Engage in academic dishonesty or cheating</li>
                      </ul>
                    </div>
                  </section>

                  <section id="privacy" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Shield className="w-6 h-6 text-primary" />
                      7. Privacy
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        Your privacy is important to us. Our collection, use, and protection of your personal 
                        information is governed by our{" "}
                        <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>, 
                        which is incorporated into these Terms by reference.
                      </p>
                      <p>
                        By using our Services, you consent to the collection and use of your information as 
                        described in our Privacy Policy.
                      </p>
                    </div>
                  </section>

                  <section id="disclaimers" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <AlertTriangle className="w-6 h-6 text-primary" />
                      8. Disclaimers & Limitations
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                        EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, 
                        FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                      </p>
                      <p>
                        We do not guarantee that the Services will be uninterrupted, secure, or error-free. We do not 
                        guarantee any specific learning outcomes or results from using our courses.
                      </p>
                      <p>
                        TO THE MAXIMUM EXTENT PERMITTED BY LAW, KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC) SHALL NOT 
                        BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING 
                        OUT OF OR RELATED TO YOUR USE OF THE SERVICES.
                      </p>
                    </div>
                  </section>

                  <section id="termination" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <XCircle className="w-6 h-6 text-primary" />
                      9. Termination
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        We may terminate or suspend your account and access to the Services immediately, without 
                        prior notice or liability, for any reason, including if you breach these Terms.
                      </p>
                      <p>
                        Upon termination, your right to use the Services will immediately cease. All provisions of 
                        these Terms which by their nature should survive termination shall survive, including 
                        intellectual property provisions, warranty disclaimers, and limitations of liability.
                      </p>
                    </div>
                  </section>

                  <section id="governing-law" className="scroll-mt-24">
                    <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                      <Gavel className="w-6 h-6 text-primary" />
                      10. Governing Law
                    </h2>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        These Terms shall be governed by and construed in accordance with the laws of India, without 
                        regard to its conflict of law provisions.
                      </p>
                      <p>
                        Any disputes arising out of or relating to these Terms or the Services shall be subject to 
                        the exclusive jurisdiction of the courts located in Bangalore, Karnataka, India.
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
                        If you have any questions about these Terms, please contact us:
                      </p>
                      <div className="bg-card rounded-lg border p-6">
                        <p className="font-semibold">KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC)</p>
                        <p>Operating as SimpleLecture</p>
                        <p className="mt-4">
                          <strong>Email:</strong> contact@simplelecture.com
                        </p>
                        <p>
                          <strong>Phone:</strong> +91 73530 21234
                        </p>
                        <p>
                          <strong>Address:</strong> Koramangala, Bangalore, Karnataka, India
                        </p>
                      </div>
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

export default TermsAndConditions;
