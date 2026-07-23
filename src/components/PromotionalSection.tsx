import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, ArrowRight, IndianRupee } from "lucide-react";
import { Link } from "react-router-dom";

export const PromotionalSection = () => {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-primary opacity-95" />
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:40px_40px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 mr-2" />
            India's Most Affordable AI Learning Platform
          </Badge>

          {/* Heading */}
          <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight">
            Complete Education at
            <span className="block mt-2">₹1000 + GST Per Course</span>
          </h2>

          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Get 1-year access to your selected course with AI tutors and expert-led content.
            Affordable learning for each course you choose.
          </p>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 pt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <IndianRupee className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Massive Cost Savings</h3>
              <p className="text-white/80">
                ₹1000 + GST per course vs high coaching fees - quality learning at a fraction of the cost
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">AI Tutors 24/7</h3>
              <p className="text-white/80">Never get stuck again. AI tutors in Hindi, English, Kannada</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Proven Results</h3>
              <p className="text-white/80">1,00,000+ students, 95% report improved grades within 3 months</p>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 inline-block">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="text-left">
                  <p className="text-white/80 text-sm mb-1">1-Year Access - Per Course</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold text-white">₹1000 + GST</span>
                    <span className="text-2xl text-white/60 line-through">₹50,000</span>
                    <Badge className="bg-success text-white">Save 96%</Badge>
                  </div>
                  <p className="text-white/80 text-sm mt-1">Per course for 1-year access</p>
                </div>
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 shadow-xl group whitespace-nowrap text-lg px-8"
                >
                  <Link to="/programs">
                    Start Learning Now
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <p className="text-white/70 text-sm">
            Join 1,00,000+ students already learning on SimpleLecture
          </p>
        </div>
      </div>
    </section>
  );
};
