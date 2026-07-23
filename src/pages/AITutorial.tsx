import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PlayCircle, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SEOHead } from '@/components/SEO';
import { SmartHeader } from '@/components/SmartHeader';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/mobile/BottomNav';

const AITutorial = () => {
  const [currentTime, setCurrentTime] = useState('00:00');

  return (
    <>
      <SEOHead title="AI Tutorial | SimpleLecture" description="AI-powered video learning" />
      <SmartHeader />
      <div className="min-h-screen pb-20 md:pb-0 bg-background">
        {/* Back Button */}
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Link to="/learning">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Learning
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-4 md:py-8">
          <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Physical Quantities</h1>
              <p className="text-sm md:text-base text-muted-foreground">Chapter 1: Units and Measurements • Physics</p>
            </div>

            {/* Video Player */}
            <Card className="overflow-hidden">
              <div className="aspect-video bg-black flex items-center justify-center">
                <PlayCircle className="h-24 w-24 text-white opacity-80 hover:opacity-100 cursor-pointer transition-opacity" />
              </div>
              <div className="p-3 md:p-4 bg-card">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-xs md:text-sm font-mono">{currentTime} / 30:00</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs">Speed: 1x</Button>
                    <Button size="sm" variant="outline" className="text-xs">Quality: 720p</Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabs: Transcript & Q&A */}
            <Tabs defaultValue="transcript" className="w-full">
              <TabsList>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="qa">Ask AI</TabsTrigger>
                <TabsTrigger value="related">Related Concepts</TabsTrigger>
              </TabsList>

              <TabsContent value="transcript" className="space-y-4">
                <Card className="p-6 max-h-[400px] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="cursor-pointer hover:bg-muted p-3 rounded">
                      <span className="text-primary font-mono text-sm mr-3">00:00</span>
                      <span className="text-sm">
                        In this lesson, we'll explore the fundamental concept of physical quantities...
                      </span>
                    </div>
                    <div className="cursor-pointer hover:bg-muted p-3 rounded">
                      <span className="text-primary font-mono text-sm mr-3">00:45</span>
                      <span className="text-sm">
                        Physical quantities are properties that can be measured...
                      </span>
                    </div>
                    <div className="cursor-pointer hover:bg-muted p-3 rounded">
                      <span className="text-primary font-mono text-sm mr-3">01:30</span>
                      <span className="text-sm">
                        We can classify physical quantities into two main categories...
                      </span>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="qa" className="space-y-4">
                <Card className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <MessageCircle className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <h3 className="font-bold mb-2">Ask AI About This Video</h3>
                      <p className="text-sm text-muted-foreground">
                        Get instant answers about the concepts explained in this video
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm">Try asking: "What are scalar and vector quantities?"</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type your question..."
                        className="flex-1 px-4 py-2 border rounded-lg"
                      />
                      <Button>Ask</Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="related" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <h4 className="font-semibold mb-2">SI Units</h4>
                    <p className="text-sm text-muted-foreground">Learn about the International System of Units</p>
                  </Card>
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <h4 className="font-semibold mb-2">Dimensional Analysis</h4>
                    <p className="text-sm text-muted-foreground">Understanding dimensions in physics</p>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Button size="lg" className="flex-1 sm:flex-none">Mark as Complete</Button>
              <Button size="lg" variant="outline" className="flex-1 sm:flex-none">Next Topic</Button>
              <Button size="lg" variant="outline" className="flex-1 sm:flex-none">Practice Questions</Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <BottomNav />
    </>
  );
};

export default AITutorial;
