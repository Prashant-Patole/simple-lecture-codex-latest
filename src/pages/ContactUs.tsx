import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/mobile/BottomNav";
import { SEOHead } from "@/components/SEO/SEOHead";
import { Button } from "@/components/ui/button";
import { generateBreadcrumbSchema } from "@/lib/seo/structuredData";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Mail, Phone, MapPin, Clock, Send, 
  MessageSquare, HelpCircle, FileText, Shield,
  BookOpen, Facebook, Twitter, Instagram, Linkedin, Youtube
} from "lucide-react";
import { toast } from "sonner";

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("Message sent successfully! We'll get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <>
      <SEOHead
        title="Contact Us"
        description="Contact SimpleLecture - Get in touch with KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC) for support, inquiries, and feedback."
        keywords="contact, support, SimpleLecture, help, customer service"
        canonicalUrl="https://simplelecture.com/contact"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            generateBreadcrumbSchema([
              { name: "Home", url: "https://simplelecture.com" },
              { name: "Contact Us", url: "https://simplelecture.com/contact" },
            ]),
            {
              "@type": "ContactPoint",
              "contactType": "Customer Service",
              "telephone": "+917353021234",
              "email": "contact@simplelecture.com",
              "availableLanguage": ["English", "Hindi", "Kannada"],
              "areaServed": "IN",
              "hoursAvailable": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "opens": "09:00",
                "closes": "18:00"
              }
            }
          ]
        }}
      />
      <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
        <Header />
        
        <main className="flex-1">
          {/* Hero Section */}
          <section className="bg-gradient-to-b from-primary/5 to-background py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <MessageSquare className="w-4 h-4" />
                  Get in Touch
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-6">
                  Contact Us
                </h1>
                <p className="text-xl text-muted-foreground">
                  Have questions or need assistance? We're here to help. Reach out to us and we'll respond as soon as possible.
                </p>
              </div>
            </div>
          </section>

          {/* Contact Info Cards */}
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                <Card className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Email Us</CardTitle>
                    <CardDescription>Send us an email anytime</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a 
                      href="mailto:contact@simplelecture.com" 
                      className="text-primary hover:underline font-medium"
                    >
                      contact@simplelecture.com
                    </a>
                  </CardContent>
                </Card>

                <Card className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Call Us</CardTitle>
                    <CardDescription>Mon-Sat, 9 AM - 6 PM IST</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a 
                      href="tel:+917353021234" 
                      className="text-primary hover:underline font-medium"
                    >
                      +91 73530 21234
                    </a>
                  </CardContent>
                </Card>

                <Card className="text-center hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Visit Us</CardTitle>
                    <CardDescription>Our office location</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Koramangala, Bangalore<br />
                      Karnataka, India
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Contact Form & Company Info */}
          <section className="py-12 md:py-16 bg-muted/30">
            <div className="container mx-auto px-4">
              <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
                {/* Contact Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Send us a Message</CardTitle>
                    <CardDescription>
                      Fill out the form below and we'll get back to you within 24 hours.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Your Name</Label>
                          <Input
                            id="name"
                            name="name"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={handleChange}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="john@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          name="subject"
                          placeholder="How can we help you?"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          name="message"
                          placeholder="Tell us more about your inquiry..."
                          rows={5}
                          value={formData.message}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          "Sending..."
                        ) : (
                          <>
                            Send Message
                            <Send className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Company Info */}
                <div className="space-y-8">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold">SimpleLecture</span>
                      </div>
                      <CardDescription>
                        India's first AI-powered learning platform
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="font-semibold text-sm">Registered Company</p>
                        <p className="text-muted-foreground">
                          KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>Business Hours: Mon-Sat, 9 AM - 6 PM IST</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Links */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Links</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <a 
                          href="/support" 
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <HelpCircle className="w-4 h-4" />
                          Help Center
                        </a>
                        <a 
                          href="/support" 
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          FAQs
                        </a>
                        <a 
                          href="/terms" 
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Terms & Conditions
                        </a>
                        <a 
                          href="/privacy" 
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Privacy Policy
                        </a>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Social Links */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Connect With Us</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <a 
                          href="#" 
                          className="w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                        >
                          <Facebook className="w-5 h-5" />
                        </a>
                        <a 
                          href="#" 
                          className="w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                        >
                          <Twitter className="w-5 h-5" />
                        </a>
                        <a 
                          href="#" 
                          className="w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                        >
                          <Instagram className="w-5 h-5" />
                        </a>
                        <a 
                          href="#" 
                          className="w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                        >
                          <Linkedin className="w-5 h-5" />
                        </a>
                        <a 
                          href="#" 
                          className="w-10 h-10 rounded-full bg-muted hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                        >
                          <Youtube className="w-5 h-5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
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

export default ContactUs;
