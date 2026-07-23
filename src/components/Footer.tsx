import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, BookOpen, Send } from "lucide-react";

import { Link } from "react-router-dom";
import headerIcon from "@/assets/header-icon.jpeg";
export const Footer = () => {
  return <footer className="bg-card border-t">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">SimpleLecture</span>
            </div>
            
            <p className="text-muted-foreground leading-relaxed max-w-md">
              India's first AI-powered learning platform offering mastery-based education 
              for board exams, entrance tests, and skill development at 99% less cost.
            </p>

            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-primary" />
                <span>+91 73530 21234</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-primary" />
                <span>contact@simplelecture.com</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <span>Koramangala, Bangalore, Karnataka, India</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold mb-4">Courses</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/programs/cbse" className="text-muted-foreground hover:text-primary transition-colors">
                  CBSE Board Coaching
                </Link>
              </li>
              <li>
                <Link to="/programs/puc" className="text-muted-foreground hover:text-primary transition-colors">
                  PUC Online Classes
                </Link>
              </li>
              <li>
                <Link to="/programs/board-exams-sslc" className="text-muted-foreground hover:text-primary transition-colors">
                  SSLC Board Coaching
                </Link>
              </li>
              <li>
                <Link to="/programs/pharmacy-courses" className="text-muted-foreground hover:text-primary transition-colors">
                  Pharmacy Courses
                </Link>
              </li>
              <li>
                <Link to="/programs" className="text-muted-foreground hover:text-primary transition-colors">
                  Browse All Online Courses
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-bold mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/success-stories" className="text-muted-foreground hover:text-primary transition-colors">
                  Success Stories
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-bold mb-4">Support</h3>
            <ul className="space-y-3">
              <li>
                <a href="/support" className="text-muted-foreground hover:text-primary transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="/support" className="text-muted-foreground hover:text-primary transition-colors">
                  FAQs
                </a>
              </li>
              <li>
                <a href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Popular Searches – SEO internal linking */}
        <nav className="mt-12 pt-8 border-t" aria-label="Popular searches">
          <h3 className="font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Popular Searches</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <Link to="/programs/cbse" className="hover:text-primary">CBSE online coaching</Link><span aria-hidden>·</span>
            <Link to="/programs/cbse/cbsc-10th" className="hover:text-primary">CBSE Class 10 online classes</Link><span aria-hidden>·</span>
            <Link to="/programs/cbse/cbsc-11th" className="hover:text-primary">CBSE Class 11 online classes</Link><span aria-hidden>·</span>
            <Link to="/programs/cbse/cbsc-12th" className="hover:text-primary">CBSE Class 12 online classes</Link><span aria-hidden>·</span>
            <Link to="/programs/puc" className="hover:text-primary">PUC online classes</Link><span aria-hidden>·</span>
            <Link to="/programs/board-exams-sslc" className="hover:text-primary">SSLC board exam coaching</Link><span aria-hidden>·</span>
            <Link to="/programs/board-exams-sslc/karnataka-sslc" className="hover:text-primary">Karnataka SSLC online classes</Link><span aria-hidden>·</span>
            <Link to="/programs/pharmacy-courses" className="hover:text-primary">Pharmacy courses online</Link><span aria-hidden>·</span>
            <Link to="/programs/pharmacy-courses/bpharm" className="hover:text-primary">B.Pharm online classes</Link><span aria-hidden>·</span>
            <Link to="/programs/pharmacy-courses/dpharm-1st-year" className="hover:text-primary">D.Pharm 1st year online</Link><span aria-hidden>·</span>
            <Link to="/programs" className="hover:text-primary">Browse all online courses</Link><span aria-hidden>·</span>
            <Link to="/success-stories" className="hover:text-primary">Student success stories</Link><span aria-hidden>·</span>
            <Link to="/how-it-works" className="hover:text-primary">How SimpleLecture works</Link>
          </div>
        </nav>


      {/* Centered Icon */}
      <div className="flex justify-center py-6">
        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-primary/20 shadow-xl">
          <img src={headerIcon} alt="SimpleLecture" className="w-full h-full object-cover" loading="lazy" width={80} height={80} />
        </div>
      </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>© 2025 KRUPA KNOWLEDGE STORE PRIVATE LIMITED (OPC). All rights reserved.</span>
              
            </div>

          </div>
        </div>
      </div>
    </footer>;
};