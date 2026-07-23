import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote, User } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface Story {
  id: string;
  name: string;
  rating: number;
  text: string;
  course: string;
}

const stories: Story[] = [
  {
    id: "1",
    name: "Rahul Kumar",
    rating: 5,
    text: "The coaching that cost my brother ₹50,000 is here for just ₹1000. I scored 94% in SSLC boards! The AI-generated MCQs were game-changers.",
    course: "10th SSLC Complete",
  },
  {
    id: "2",
    name: "Deepika Rao",
    rating: 5,
    text: "The AI tutor explains in Kannada which helped me understand Physics better. Scored 92% for the first time! SimpleLecture made SSLC board exams easy.",
    course: "10th SSLC Complete",
  },
  {
    id: "3",
    name: "Arjun Patel",
    rating: 5,
    text: "At just ₹1000 a year, this is 100x better than my ₹80,000 coaching. The AI tutor was available 24/7, no traveling, and very personalized.",
    course: "10th SSLC Complete",
  },
  {
    id: "4",
    name: "Sneha Iyer",
    rating: 5,
    text: "Chapter-wise mastery tests pushed me to revise until I really understood each topic. I scored 95% in my SSLC boards.",
    course: "10th SSLC Complete",
  },
  {
    id: "5",
    name: "Karthik Nair",
    rating: 5,
    text: "Doubt clearing in regional language and instant practice questions are amazing. I cleared all my SSLC subjects with distinction.",
    course: "10th SSLC Complete",
  },
  {
    id: "6",
    name: "Meera Joshi",
    rating: 5,
    text: "Affordable and high quality. The dashboard tracked my progress every week and motivated me to keep going. Scored 93% in SSLC.",
    course: "10th SSLC Complete",
  },
  {
    id: "7",
    name: "Aditya Reddy",
    rating: 5,
    text: "Best decision my parents made. SimpleLecture's AI lectures are simple, focused, and exam-oriented. Got 91% in 10th boards.",
    course: "10th SSLC Complete",
  },
  {
    id: "8",
    name: "Pooja Verma",
    rating: 5,
    text: "I used to fear maths. After daily practice on SimpleLecture, I started enjoying it. Scored full marks in SSLC maths.",
    course: "10th SSLC Complete",
  },
  {
    id: "9",
    name: "Ravi Shankar",
    rating: 5,
    text: "Recorded lectures plus AI doubt support helped me prepare even when I missed school. Cleared SSLC with 90%.",
    course: "10th SSLC Complete",
  },
];

const SuccessStories = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Badge className="mb-4">Success Stories</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Real Students. <span className="bg-gradient-primary bg-clip-text text-transparent">Real Results.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            10th SSLC students sharing how SimpleLecture helped them score higher in board exams.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((s) => (
            <Card key={s.id} className="relative hover:shadow-hover transition-all duration-300 group overflow-hidden">
              <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Quote className="w-16 h-16 text-primary" />
              </div>
              <CardContent className="pt-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(s.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed">"{s.text}"</p>
                <Badge variant="secondary" className="mb-6 text-xs">{s.course}</Badge>
                <div className="flex items-center gap-3 pt-4 border-t">
                  <div className="w-12 h-12 rounded-full bg-primary/10 ring-2 ring-primary/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">10th SSLC</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SuccessStories;
