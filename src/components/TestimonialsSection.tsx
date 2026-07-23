import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote, User } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  rating: number;
  text: string;
  course: string;
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Priya Sharma",
    role: "10th SSLC",
    rating: 5,
    text: "I scored 95% in SSLC Science with SimpleLecture's AI tutors. The mastery-based approach ensured I was truly prepared. Best ₹1000 I ever spent!",
    course: "10th SSLC Complete",
  },
  {
    id: "2",
    name: "Rahul Kumar",
    role: "10th SSLC",
    rating: 5,
    text: "The coaching that cost my brother ₹50,000 is here for just ₹1000. I scored 94% in SSLC boards! The AI-generated MCQs were game-changers.",
    course: "10th SSLC Complete",
  },
  {
    id: "3",
    name: "Ananya Reddy",
    role: "10th SSLC",
    rating: 5,
    text: "From struggling with physics to scoring 98% in SSLC boards. The chapter-wise progression and AI tutor made learning so structured. My parents loved the progress reports too!",
    course: "10th SSLC Complete",
  },
  {
    id: "4",
    name: "Arjun Patel",
    role: "10th SSLC",
    rating: 5,
    text: "At just ₹1000 + GST/year, this is 100x better than my ₹80,000 coaching. AI tutor was available 24/7 for SSLC prep, no traveling, and personalized attention. Highly recommended!",
    course: "10th SSLC Complete",
  },
  {
    id: "5",
    name: "Deepika R.",
    role: "10th SSLC",
    rating: 5,
    text: "The AI tutor explains in Kannada which helped me understand Physics better. Scored 90+ for the first time! SimpleLecture made SSLC board exams easy.",
    course: "10th SSLC Complete",
  },
  {
    id: "6",
    name: "Vikram Singh",
    role: "10th SSLC",
    rating: 5,
    text: "The adaptive learning path and AI-generated tests were perfect for SSLC board preparation. Building a strong foundation now. SimpleLecture is the future!",
    course: "10th SSLC Complete",
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-20 bg-muted/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <Badge className="mb-4">Success Stories</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            What Our <span className="bg-gradient-primary bg-clip-text text-transparent">Students Say</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of successful learners who transformed their academic journey
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {testimonials.map((testimonial) => (
            <Card 
              key={testimonial.id}
              className="relative hover:shadow-hover transition-all duration-300 group overflow-hidden"
            >
              {/* Quote Icon */}
              <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Quote className="w-16 h-16 text-primary" />
              </div>

              <CardContent className="pt-6">
                {/* Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Testimonial Text */}
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* Course Badge */}
                <Badge variant="secondary" className="mb-6 text-xs">
                  {testimonial.course}
                </Badge>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <div className="w-12 h-12 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-16">
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              1,00,000+
            </div>
            <p className="text-muted-foreground">Active Students</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              4.9/5
            </div>
            <p className="text-muted-foreground">Average Rating</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              95%
            </div>
            <p className="text-muted-foreground">Success Rate</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              24/7
            </div>
            <p className="text-muted-foreground">AI Support</p>
          </div>
        </div>
      </div>
    </section>
  );
};
