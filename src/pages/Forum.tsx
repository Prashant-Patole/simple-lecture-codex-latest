import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEO';
import { MessageSquare, Users, Plus, BookOpen, HelpCircle, ArrowRight, Lock, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForumCategories } from '@/hooks/useForumCategories';
import { useForumGroups, useJoinGroup, useLeaveGroup } from '@/hooks/useForumGroups';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import CreatePostDialog from '@/components/forum/CreatePostDialog';
import CreateGroupDialog from '@/components/forum/CreateGroupDialog';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const Forum = () => {
  const navigate = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = useForumCategories();
  const { data: groups, isLoading: groupsLoading } = useForumGroups();
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const generalCategory = categories?.find(c => c.is_general);
  const subjectCategories = categories?.filter(c => !c.is_general) || [];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 flex flex-col">
      <Header />
      <SEOHead
        title="Community Forum"
        description="Join the SimpleLecture student community forum. Ask questions, share knowledge, get AI-assisted answers, and connect with peers across subjects."
        keywords="student forum, discussion board, ask questions, peer learning, SimpleLecture community"
        canonicalUrl="https://simplelecture.com/forum"
      />
        <div className="container mx-auto px-4 py-4 md:py-8">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Home
        </Link>
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Discussion Forum</h1>
          <p className="text-muted-foreground">
            Ask questions, share knowledge, and connect with your peers
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-4 md:mb-8">
          <Button onClick={() => setCreatePostOpen(true)} disabled={!user}>
            <Plus className="w-4 h-4 mr-2" />
            New Question
          </Button>
          <Button variant="outline" onClick={() => setCreateGroupOpen(true)} disabled={!user}>
            <Users className="w-4 h-4 mr-2" />
            Create Group
          </Button>
          {!user && (
            <p className="text-sm text-muted-foreground self-center">
              <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to post questions
            </p>
          )}
        </div>

        {/* Info Card */}
        <Card className="mb-4 md:mb-8 border-primary/20 bg-primary/5">
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-start gap-3 md:gap-4">
              <HelpCircle className="w-6 h-6 md:w-8 md:h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-2">How the Forum Works</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Post questions in the appropriate category (subject or general)</li>
                  <li>• For general queries, if no one answers within 10 minutes, AI will help!</li>
                  <li>• Upvote helpful answers and mark accepted solutions</li>
                  <li>• Join groups to discuss topics with peers</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="groups">Discussion Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-6">
            {/* General Discussions */}
            {generalCategory && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  General Discussions
                </h2>
                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => navigate(`/forum/category/${generalCategory.slug}`)}
                >
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{generalCategory.name}</CardTitle>
                        <CardDescription>{generalCategory.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <Badge variant="secondary">
                          {generalCategory.post_count || 0} posts
                        </Badge>
                        <Badge className="bg-primary/20 text-primary">
                          AI Assisted
                        </Badge>
                        <ArrowRight className="w-5 h-5 text-muted-foreground hidden sm:block" />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            )}

            {/* Subject Categories */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Subject-Specific Categories
              </h2>
              {categoriesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-4 bg-muted rounded w-1/2" />
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjectCategories.map(category => (
                    <Card 
                      key={category.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => navigate(`/forum/category/${category.slug}`)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{category.name}</CardTitle>
                          <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>{category.description}</span>
                          <Badge variant="secondary" className="ml-2">
                            {category.post_count || 0}
                          </Badge>
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Discussion Groups
              </h2>
            </div>

            {groupsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : groups?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No groups yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Be the first to create a discussion group!
                  </p>
                  <Button onClick={() => setCreateGroupOpen(true)} disabled={!user}>
                    Create Group
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups?.map(group => (
                  <Card 
                    key={group.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      group.is_member ? 'hover:border-primary' : ''
                    }`}
                    onClick={() => {
                      if (group.is_member) {
                        navigate(`/forum/group/${group.id}`);
                      }
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {/* Group Avatar */}
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                            {group.avatar_url ? (
                              <img 
                                src={group.avatar_url} 
                                alt={group.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-semibold text-primary">
                                {group.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2 truncate">
                              {group.name}
                              {group.is_private && (
                                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                            </CardTitle>
                            {group.subject && (
                              <Badge variant="secondary" className="flex-shrink-0 ml-2">{group.subject.name}</Badge>
                            )}
                          </div>
                          <CardDescription className="line-clamp-1">
                            {group.description || 'No description'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                        </span>
                        {user && (
                          group.is_member ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Joined</Badge>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  leaveGroup.mutate(group.id);
                                }}
                                disabled={leaveGroup.isPending}
                              >
                                Leave
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                joinGroup.mutate(group.id);
                              }}
                              disabled={joinGroup.isPending || (group.is_private)}
                            >
                              {group.is_private ? 'Private' : 'Join'}
                            </Button>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Footer />

      <CreatePostDialog 
        open={createPostOpen} 
        onOpenChange={setCreatePostOpen}
        categories={categories || []}
      />
      <BottomNav />
      <CreateGroupDialog 
        open={createGroupOpen} 
        onOpenChange={setCreateGroupOpen}
      />
    </div>
  );
};

export default Forum;
