import { SEOHead } from "@/components/SEO/SEOHead";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GraduationCap, Brain, IndianRupee, Target, Mail, Phone, MapPin, BookOpen, Users, Sparkles } from "lucide-react";
import { generateOrganizationSchema, generateBreadcrumbSchema } from "@/lib/seo/structuredData";

const AboutUs = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      generateOrganizationSchema(),
      generateBreadcrumbSchema([
        { name: "Home", url: "https://simplelecture.com" },
        { name: "About Us", url: "https://simplelecture.com/about" },
      ]),
    ],
  };

  return (
    <>
      <SEOHead
        title="About Us"
        description="Learn about SimpleLecture by KRUPA KNOWLEDGE STORE PRIVATE LIMITED — AI-powered affordable education platform. Quality courses at ₹1000/year for SSLC, PUC, NEET & JEE."
        keywords="SimpleLecture, about, AI education, KRUPA KNOWLEDGE STORE, affordable learning, board exams, NEET, JEE"
        canonicalUrl="https://simplelecture.com/about"
        structuredData={structuredData}
      />
      <Header />
      <main className="min-h-screen bg-background">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-4">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <li><a href="/" className="hover:text-primary transition-colors">Home</a></li>
            <li>/</li>
            <li className="text-foreground font-medium">About Us</li>
          </ol>
        </nav>

        {/* Hero Section */}
        <section className="relative py-20 md:py-28 bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto px-4 text-center max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              About SimpleLecture
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Inspired by the vision of Dr. Nagpal, we believe quality education should not be a privilege — it should be accessible to every student.
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid md:grid-cols-2 gap-10">
              <div className="bg-card border border-border rounded-2xl p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To democratize quality education by leveraging AI technology, making it possible for every student — regardless of their economic background — to access personalized, mastery-based learning at a fraction of traditional costs.
                </p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Our Vision</h2>
                <p className="text-muted-foreground leading-relaxed">
                  At Simple Lecture, our vision is rooted in the belief that quality education should not be a privilege — it should be accessible to every student. Inspired by the mission of Dr. Nagpal, who dedicated himself to bringing education to the doorstep of every learner, we are committed to making learning affordable, engaging, and effective for all.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dr. Nagpal's Legacy */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-primary blur-3xl" />
            <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-accent blur-3xl" />
          </div>
          <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Dr. Nagpal's Legacy
            </h2>
            <blockquote className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6 italic border-l-4 border-primary pl-6 text-left">
              "Dr. Nagpal envisioned a world where students from all backgrounds have access to high-quality educational resources without financial barriers. To make this a reality, we strive to offer comprehensive, structured courses at just <strong className="text-foreground">₹1,000</strong>, empowering students to unlock their academic potential and pursue their dreams without compromise."
            </blockquote>
            <p className="text-lg md:text-xl font-medium text-foreground leading-relaxed">
              At Simple Lecture, we combine innovative teaching methods, expert instructors, and student-centric technology to bring that vision to life — <span className="text-primary font-semibold">because education should open doors, not close them.</span>
            </p>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-3xl font-bold text-foreground text-center mb-12">
              What Makes Us Different
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Brain className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">AI-Powered Tutoring</h3>
                <p className="text-muted-foreground">
                  Every student gets a personal AI tutor that adapts to their learning style, answers doubts instantly, and provides step-by-step explanations in multiple languages.
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <IndianRupee className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">99% Cost Reduction</h3>
                <p className="text-muted-foreground">
                  By harnessing AI, we've reduced the cost of quality education by up to 99% compared to traditional coaching, making it accessible to millions of students.
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <GraduationCap className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">Mastery-Based Learning</h3>
                <p className="text-muted-foreground">
                  Our platform ensures students truly understand each concept before moving ahead, using AI-generated practice, quizzes, and personalized feedback loops.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl font-bold text-foreground text-center mb-8">Our Story</h2>
            <div className="bg-card border border-border rounded-2xl p-8 md:p-10">
              <div className="space-y-5 text-muted-foreground leading-relaxed">
                <p>
                  SimpleLecture is a product of <strong className="text-foreground">KRUPA KNOWLEDGE STORE PRIVATE LIMITED</strong>, founded to carry forward <strong className="text-foreground">Dr. Nagpal's vision</strong> — that no student should be left behind due to financial constraints.
                </p>
                <p>
                  We observed that quality coaching in India costs lakhs of rupees — putting it out of reach for the vast majority of families. Dr. Nagpal believed this was unacceptable. At the same time, advances in AI made it possible to deliver personalized, high-quality instruction at near-zero marginal cost.
                </p>
                <p>
                  SimpleLecture bridges this gap. Inspired by Dr. Nagpal's lifelong dedication to accessible education, our AI-powered platform delivers expert-level tutoring, video lessons, daily practice problems, and live classes — all at just ₹1,000, a price that any Indian family can afford.
                </p>
                <p>
                  We're committed to continuously improving our platform, expanding our course offerings, and ensuring every student who dreams of academic success has the tools to achieve it — just as Dr. Nagpal envisioned.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-bold text-foreground">1,00,000+</div>
                <div className="text-sm text-muted-foreground mt-1">Students Learning</div>
              </div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-bold text-foreground">50+</div>
                <div className="text-sm text-muted-foreground mt-1">Courses Available</div>
              </div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-bold text-foreground">24/7</div>
                <div className="text-sm text-muted-foreground mt-1">AI Tutor Access</div>
              </div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <IndianRupee className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-bold text-foreground">99%</div>
                <div className="text-sm text-muted-foreground mt-1">Cost Savings</div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl font-bold text-foreground text-center mb-10">Get In Touch</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Address</h3>
                <p className="text-sm text-muted-foreground">
                  Koramangala, Bangalore,<br />
                  Karnataka, India
                </p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Phone</h3>
                <p className="text-sm text-muted-foreground">
                  <a href="tel:+917353021234" className="hover:text-primary transition-colors">+91 73530 21234</a>
                </p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Email</h3>
                <p className="text-sm text-muted-foreground">
                  <a href="mailto:contact@simplelecture.com" className="hover:text-primary transition-colors">contact@simplelecture.com</a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default AboutUs;
