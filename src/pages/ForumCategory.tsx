import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEO';
import { ArrowLeft, Plus, MessageSquare, Eye, Clock, CheckCircle, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useForumPosts } from '@/hooks/useForumPosts';
import { useForumCategories } from '@/hooks/useForumCategories';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import CreatePostDialog from '@/components/forum/CreatePostDialog';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const ForumCategory = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: posts, isLoading } = useForumPosts(slug);
  const { data: categories } = useForumCategories();
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const category = categories?.find(c => c.slug === slug);

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-background flex flex-col">
      <Header />
      <SEOHead
        title={category?.name ? `${category.name} Forum` : 'Forum Category'}
        description={category?.description || `Browse and ask questions in the ${category?.name || ''} category on SimpleLecture forum.`}
        keywords={`${category?.name || ''}, forum, student questions, discussions`}
        canonicalUrl={`https://simplelecture.com/forum/category/${slug}`}
      />
      <div className="container mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Home
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link to="/forum" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              Forum
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">{category?.name || 'Category'}</h1>
              <p className="text-muted-foreground text-sm md:text-base">{category?.description}</p>
            </div>
            <Button onClick={() => setCreatePostOpen(true)} disabled={!user} className="self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" />
              New Question
            </Button>
          </div>
          {category?.is_general && (
            <Badge className="mt-4 bg-primary/20 text-primary">
              <Bot className="w-3 h-3 mr-1" />
              AI will answer unanswered questions after 10 minutes
            </Badge>
          )}
        </div>

        {/* Posts List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : posts?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No questions yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to ask a question in this category!
              </p>
              <Button onClick={() => setCreatePostOpen(true)} disabled={!user}>
                Ask a Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts?.map(post => (
              <Card 
                key={post.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/forum/post/${post.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-8 w-8 md:h-10 md:w-10">
                      <AvatarFallback>
                        {post.author?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{post.title}</CardTitle>
                        {post.is_pinned && (
                          <Badge variant="secondary">Pinned</Badge>
                        )}
                        {post.is_answered && (
                          <Badge className="bg-green-500/20 text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Answered
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                        {post.content}
                      </p>
                      <div className="flex items-center flex-wrap gap-2 md:gap-4 mt-3 text-sm text-muted-foreground">
                        <span>{post.author?.full_name || 'Anonymous'}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {post.reply_count} replies
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {post.view_count} views
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Footer />

      <CreatePostDialog 
        open={createPostOpen} 
        onOpenChange={setCreatePostOpen}
        categories={categories || []}
        defaultCategoryId={category?.id}
      />
      <BottomNav />
    </div>
  );
};

export default ForumCategory;
