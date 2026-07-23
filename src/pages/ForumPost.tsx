import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEO';
import { ArrowLeft, ThumbsUp, CheckCircle, Bot, Flag, Clock, Eye, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useForumPost } from '@/hooks/useForumPosts';
import { useForumReplies, useCreateForumReply, useToggleUpvote, useAcceptAnswer } from '@/hooks/useForumReplies';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import FlagContentDialog from '@/components/forum/FlagContentDialog';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const ForumPost = () => {
  const { id } = useParams<{ id: string }>();
  const { data: post, isLoading: postLoading } = useForumPost(id || '');
  const { data: replies, isLoading: repliesLoading } = useForumReplies(id || '');
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });
  const createReply = useCreateForumReply();
  const toggleUpvote = useToggleUpvote();
  const acceptAnswer = useAcceptAnswer();

  const [replyContent, setReplyContent] = useState('');
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagTarget, setFlagTarget] = useState<{ type: 'post' | 'reply'; id: string } | null>(null);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !id) return;
    await createReply.mutateAsync({ postId: id, content: replyContent });
    setReplyContent('');
  };

  const handleFlag = (type: 'post' | 'reply', targetId: string) => {
    setFlagTarget({ type, id: targetId });
    setFlagDialogOpen(true);
  };

  const isAuthor = user?.id === post?.author_id;

  if (postLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-background flex flex-col">
      <Header />
      <SEOHead
        title={post?.title || 'Forum Post'}
        description={post?.content ? post.content.substring(0, 155) + '...' : 'View this discussion on SimpleLecture forum.'}
        keywords="forum post, student discussion, SimpleLecture"
      />
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
        {/* Back Links */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Home
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link
            to={post?.category?.slug ? `/forum/category/${post.category.slug}` : '/forum'}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            {post?.category?.name || 'Forum'}
          </Link>
        </div>

        {/* Post */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10 md:h-12 md:w-12">
                <AvatarFallback className="text-lg">
                  {post?.author?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <CardTitle className="text-lg md:text-xl">{post?.title}</CardTitle>
                  {post?.is_answered && (
                    <Badge className="bg-green-500/20 text-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Answered
                    </Badge>
                  )}
                </div>
                <div className="flex items-center flex-wrap gap-2 md:gap-4 text-sm text-muted-foreground">
                  <span className="font-medium">{post?.author?.full_name || 'Anonymous'}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post?.created_at && formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {post?.view_count} views
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert mb-4">
              <p className="whitespace-pre-wrap">{post?.content}</p>
            </div>
            {user && !isAuthor && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground"
                onClick={() => handleFlag('post', post?.id || '')}
              >
                <Flag className="w-4 h-4 mr-1" />
                Report
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Replies Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h2 className="text-lg font-semibold">
              {replies?.length || 0} {replies?.length === 1 ? 'Reply' : 'Replies'}
            </h2>
          </div>

          {repliesLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-16 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : replies?.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No replies yet. Be the first to answer!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {replies?.map(reply => (
                <Card 
                  key={reply.id}
                  className={reply.is_accepted_answer ? 'border-green-500 bg-green-500/5' : ''}
                >
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      {/* Upvote Section */}
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={reply.user_upvoted ? 'text-primary' : ''}
                          onClick={() => toggleUpvote.mutate({ 
                            replyId: reply.id, 
                            isUpvoted: reply.user_upvoted || false 
                          })}
                          disabled={!user || toggleUpvote.isPending}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium">{reply.upvotes}</span>
                      </div>

                      {/* Reply Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {reply.is_ai_generated ? (
                                <Bot className="w-4 h-4" />
                              ) : (
                                reply.author?.full_name?.charAt(0) || 'U'
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {reply.is_ai_generated ? 'AI Assistant' : reply.author?.full_name || 'Anonymous'}
                          </span>
                          {reply.is_ai_generated && (
                            <Badge variant="secondary" className="text-xs">
                              <Bot className="w-3 h-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                          {reply.is_accepted_answer && (
                            <Badge className="bg-green-500/20 text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Accepted Answer
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground sm:ml-auto">
                            {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <p className="whitespace-pre-wrap">{reply.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {isAuthor && !reply.is_accepted_answer && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => acceptAnswer.mutate({ replyId: reply.id, postId: id || '' })}
                              disabled={acceptAnswer.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Accept Answer
                            </Button>
                          )}
                          {user && user.id !== reply.author_id && !reply.is_ai_generated && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-muted-foreground"
                              onClick={() => handleFlag('reply', reply.id)}
                            >
                              <Flag className="w-4 h-4 mr-1" />
                              Report
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Separator />

          {/* Reply Form */}
          {user ? (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Your Answer</h3>
                <Textarea
                  placeholder="Write your answer here..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={4}
                  className="mb-4"
                />
                <Button 
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || createReply.isPending}
                >
                  {createReply.isPending ? 'Posting...' : 'Post Answer'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-6">
              <CardContent>
                <p className="text-muted-foreground">
                  <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to post an answer
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Footer />

      <FlagContentDialog
        open={flagDialogOpen}
        onOpenChange={setFlagDialogOpen}
        target={flagTarget}
      />
      <BottomNav />
    </div>
  );
};

export default ForumPost;
