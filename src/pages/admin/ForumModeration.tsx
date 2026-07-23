import React from 'react';
import { MessageSquare, Flag, AlertTriangle, Bot, Trash2, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  useUnansweredPosts, 
  useFlaggedContent, 
  useReviewFlag, 
  useDeletePost,
  useTriggerAIReply 
} from '@/hooks/useForumModeration';
import { useForumPosts } from '@/hooks/useForumPosts';

const ForumModeration = () => {
  const navigate = useNavigate();
  const { data: unansweredPosts, isLoading: unansweredLoading } = useUnansweredPosts();
  const { data: flaggedContent, isLoading: flaggedLoading } = useFlaggedContent();
  const { data: allPosts, isLoading: postsLoading } = useForumPosts();
  const reviewFlag = useReviewFlag();
  const deletePost = useDeletePost();
  const triggerAIReply = useTriggerAIReply();

  const handleTriggerAI = async (postId: string) => {
    try {
      await triggerAIReply.mutateAsync(postId);
      toast.success('AI reply triggered successfully');
    } catch (error) {
      toast.error('Failed to trigger AI reply');
    }
  };

  const handleReviewFlag = async (flagId: string, action: 'dismiss' | 'action') => {
    try {
      await reviewFlag.mutateAsync({ flagId, action });
      toast.success(action === 'dismiss' ? 'Flag dismissed' : 'Action taken');
    } catch (error) {
      toast.error('Failed to review flag');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost.mutateAsync(postId);
      toast.success('Post deleted');
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <MessageSquare className="w-8 h-8" />
          Forum Moderation
        </h1>
        <p className="text-muted-foreground">
          Manage forum posts, review flagged content, and trigger AI responses
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unanswered Questions</CardDescription>
            <CardTitle className="text-3xl">{unansweredPosts?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Flags</CardDescription>
            <CardTitle className="text-3xl text-destructive">{flaggedContent?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Posts</CardDescription>
            <CardTitle className="text-3xl">{allPosts?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="unanswered" className="space-y-6">
        <TabsList>
          <TabsTrigger value="unanswered" className="gap-2">
            <Bot className="w-4 h-4" />
            Unanswered ({unansweredPosts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="flagged" className="gap-2">
            <Flag className="w-4 h-4" />
            Flagged ({flaggedContent?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            All Posts
          </TabsTrigger>
        </TabsList>

        {/* Unanswered Posts Tab */}
        <TabsContent value="unanswered">
          <Card>
            <CardHeader>
              <CardTitle>Unanswered Questions</CardTitle>
              <CardDescription>
                Posts that haven't received any replies yet. Trigger AI to respond.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unansweredLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : unansweredPosts?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>All questions have been answered!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Posted</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unansweredPosts?.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {post.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {post.category?.name || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(post.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>{post.view_count}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/forum/post/${post.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleTriggerAI(post.id)}
                            disabled={triggerAIReply.isPending}
                          >
                            <Bot className="w-4 h-4 mr-1" />
                            AI Reply
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flagged Content Tab */}
        <TabsContent value="flagged">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Flagged Content
              </CardTitle>
              <CardDescription>
                Review reported posts and replies. Take action or dismiss flags.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {flaggedLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : flaggedContent?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>No flagged content to review!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Content Preview</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Reported By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flaggedContent?.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <Badge variant={flag.post_id ? 'default' : 'secondary'}>
                            {flag.post_id ? 'Post' : 'Reply'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {flag.post?.content || flag.reply?.content || 'Content not available'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-destructive">
                            {flag.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {flag.reporter?.full_name || 'Anonymous'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(flag.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {flag.post_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/forum/post/${flag.post_id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReviewFlag(flag.id, 'dismiss')}
                            disabled={reviewFlag.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Dismiss
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReviewFlag(flag.id, 'action')}
                            disabled={reviewFlag.isPending}
                          >
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Take Action
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Posts Tab */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Forum Posts</CardTitle>
              <CardDescription>
                Overview of all forum posts. Delete inappropriate content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : allPosts?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                  <p>No forum posts yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Replies</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPosts?.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {post.title}
                        </TableCell>
                        <TableCell>
                          {post.is_answered ? (
                            <Badge className="bg-green-500">Answered</Badge>
                          ) : (
                            <Badge variant="secondary">Open</Badge>
                          )}
                          {post.status === 'flagged' && (
                            <Badge variant="destructive" className="ml-1">Flagged</Badge>
                          )}
                        </TableCell>
                        <TableCell>{post.reply_count}</TableCell>
                        <TableCell>{post.view_count}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(post.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/forum/post/${post.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeletePost(post.id)}
                            disabled={deletePost.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ForumModeration;
