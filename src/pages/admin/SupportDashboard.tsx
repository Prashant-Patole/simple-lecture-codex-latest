import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  HelpCircle, 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Bot,
  RefreshCw,
  ArrowLeft,
  FileText,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { format } from "date-fns";

import { 
  useAdminSupportArticles, 
  useCreateArticle, 
  useUpdateArticle, 
  useDeleteArticle,
  SupportArticle 
} from "@/hooks/useSupportArticles";
import { Switch } from "@/components/ui/switch";

const FAQ_CATEGORIES = [
  { value: 'account', label: 'Account' },
  { value: 'payment', label: 'Payment' },
  { value: 'technical', label: 'Technical' },
  { value: 'courses', label: 'Courses' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'general', label: 'General' },
];

const ICON_OPTIONS = [
  { value: 'BookOpen', label: 'Book' },
  { value: 'GraduationCap', label: 'Graduation Cap' },
  { value: 'Settings', label: 'Settings' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Shield', label: 'Shield' },
  { value: 'Wrench', label: 'Wrench' },
  { value: 'HelpCircle', label: 'Help Circle' },
  { value: 'FileText', label: 'File' },
];

const SupportDashboard = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("tickets");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [adminReply, setAdminReply] = useState("");
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [faqForm, setFaqForm] = useState({ category: '', question: '', answer: '', display_order: 0 });
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  
  // Article state
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<SupportArticle | null>(null);
  const [articleForm, setArticleForm] = useState({
    slug: '',
    title: '',
    description: '',
    content: '',
    icon_name: 'BookOpen',
    display_order: 0,
    is_active: true,
  });

  // Handle ticket selection
  const handleTicketClick = (ticket: any) => {
    setSelectedTicket(ticket);
    setDetailSheetOpen(true);
  };

  // Fetch tickets
  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['admin-support-tickets'],
    queryFn: async () => {
      const { data: ticketsData, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!ticketsData || ticketsData.length === 0) return [];

      const userIds = Array.from(new Set(ticketsData.map((t: any) => t.user_id).filter(Boolean)));
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone_number')
          .in('id', userIds);
        profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      }

      return ticketsData.map((t: any) => ({ ...t, profiles: profileMap.get(t.user_id) || null }));
    },
  });

  // Fetch ticket messages
  const { data: ticketMessages } = useQuery({
    queryKey: ['ticket-messages', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicket,
  });

  // Fetch FAQs
  const { data: faqs, isLoading: faqsLoading } = useQuery({
    queryKey: ['admin-faqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_faqs')
        .select('*')
        .order('category', { ascending: true })
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch articles
  const { data: articles, isLoading: articlesLoading } = useAdminSupportArticles();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();

  // Send admin reply
  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket || !adminReply.trim()) return;

      await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_type: 'admin',
        content: adminReply.trim()
      });

      await supabase
        .from('support_tickets')
        .update({ status: 'admin_responded' })
        .eq('id', selectedTicket.id);
    },
    onSuccess: () => {
      toast({ title: "Reply sent successfully" });
      setAdminReply("");
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    },
    onError: () => {
      toast({ title: "Failed to send reply", variant: "destructive" });
    }
  });

  // Close ticket
  const closeTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      await supabase
        .from('support_tickets')
        .update({ status: 'closed_resolved', closed_at: new Date().toISOString() })
        .eq('id', ticketId);
    },
    onSuccess: () => {
      toast({ title: "Ticket closed" });
      setSelectedTicket(null);
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    }
  });

  // FAQ mutations
  const saveFaqMutation = useMutation({
    mutationFn: async () => {
      if (editingFaq) {
        await supabase.from('support_faqs').update(faqForm).eq('id', editingFaq.id);
      } else {
        await supabase.from('support_faqs').insert(faqForm);
      }
    },
    onSuccess: () => {
      toast({ title: editingFaq ? "FAQ updated" : "FAQ created" });
      setFaqDialogOpen(false);
      setEditingFaq(null);
      setFaqForm({ category: '', question: '', answer: '', display_order: 0 });
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
    }
  });

  const deleteFaqMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('support_faqs').delete().eq('id', id);
    },
    onSuccess: () => {
      toast({ title: "FAQ deleted" });
      queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });
    }
  });

  const openEditFaq = (faq: any) => {
    setEditingFaq(faq);
    setFaqForm({
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
      display_order: faq.display_order
    });
    setFaqDialogOpen(true);
  };

  // Article helpers
  const openEditArticle = (article: SupportArticle) => {
    setEditingArticle(article);
    setArticleForm({
      slug: article.slug,
      title: article.title,
      description: article.description,
      content: article.content,
      icon_name: article.icon_name,
      display_order: article.display_order,
      is_active: article.is_active,
    });
    setArticleDialogOpen(true);
  };

  const handleSaveArticle = () => {
    if (editingArticle) {
      updateArticle.mutate({
        id: editingArticle.id,
        ...articleForm,
      }, {
        onSuccess: () => {
          setArticleDialogOpen(false);
          setEditingArticle(null);
          setArticleForm({
            slug: '',
            title: '',
            description: '',
            content: '',
            icon_name: 'BookOpen',
            display_order: 0,
            is_active: true,
          });
        }
      });
    } else {
      createArticle.mutate(articleForm, {
        onSuccess: () => {
          setArticleDialogOpen(false);
          setArticleForm({
            slug: '',
            title: '',
            description: '',
            content: '',
            icon_name: 'BookOpen',
            display_order: 0,
            is_active: true,
          });
        }
      });
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      open: { variant: "default", label: "Open" },
      ai_responded: { variant: "secondary", label: "AI Responded" },
      escalated_to_admin: { variant: "destructive", label: "Escalated" },
      admin_responded: { variant: "outline", label: "Admin Replied" },
      closed_resolved: { variant: "outline", label: "Resolved" },
    };
    const c = config[status] || { variant: "secondary", label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const escalatedCount = tickets?.filter(t => t.status === 'escalated_to_admin').length || 0;
  const openCount = tickets?.filter(t => !t.status.includes('closed')).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Support Dashboard
          </h1>
          <p className="text-muted-foreground">Manage support tickets and FAQ articles</p>
        </div>
        <div className="flex gap-4">
          <Card className="px-4 py-2">
            <div className="text-sm text-muted-foreground">Open Tickets</div>
            <div className="text-2xl font-bold">{openCount}</div>
          </Card>
          <Card className="px-4 py-2 border-destructive">
            <div className="text-sm text-muted-foreground">Escalated</div>
            <div className="text-2xl font-bold text-destructive">{escalatedCount}</div>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tickets" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Support Tickets
          </TabsTrigger>
          <TabsTrigger value="faqs" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Manage FAQs
          </TabsTrigger>
          <TabsTrigger value="articles" className="gap-2">
            <FileText className="h-4 w-4" />
            Manage Articles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          {/* Tickets List - Full Width */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">All Tickets</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetchTickets()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {tickets?.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTicket?.id === ticket.id ? 'bg-accent border-primary' : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium truncate flex-1">{ticket.subject}</p>
                        {getStatusBadge(ticket.status)}
                      </div>
                      {(ticket as any).profiles && (
                        <p className="text-sm text-foreground/80 truncate">
                          {(ticket as any).profiles.full_name || 'Unknown User'}
                          {(ticket as any).profiles.email && (
                            <span className="text-muted-foreground ml-1">({(ticket as any).profiles.email})</span>
                          )}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="capitalize">{ticket.category}</span>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(ticket.created_at), "MMM d, h:mm a")}</span>
                      </div>
                    </div>
                  ))}
                  {(!tickets || tickets.length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No support tickets yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Ticket Detail Sheet */}
          <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
            <SheetContent side="right" className="w-full sm:max-w-lg">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 lg:hidden"
                    onClick={() => setDetailSheetOpen(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="truncate">{selectedTicket?.subject || "Ticket Details"}</span>
                </SheetTitle>
                {selectedTicket && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{selectedTicket.category}</Badge>
                      {getStatusBadge(selectedTicket.status)}
                    </div>
                    {selectedTicket.profiles && (
                      <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
                        <p className="font-medium">{selectedTicket.profiles.full_name || 'Unknown User'}</p>
                        {selectedTicket.profiles.email && (
                          <p>
                            <a href={`mailto:${selectedTicket.profiles.email}`} className="text-primary hover:underline">
                              {selectedTicket.profiles.email}
                            </a>
                          </p>
                        )}
                        {selectedTicket.profiles.phone_number && (
                          <p>
                            <a href={`tel:${selectedTicket.profiles.phone_number}`} className="text-primary hover:underline">
                              📞 {selectedTicket.profiles.phone_number}
                            </a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </SheetHeader>

              {selectedTicket && (
                <div className="space-y-4 h-[calc(100vh-180px)] flex flex-col">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-3">
                      {ticketMessages?.map((msg) => (
                        <div key={msg.id} className={`flex gap-2 ${msg.sender_type === 'user' ? '' : 'flex-row-reverse'}`}>
                          <div className={`p-3 rounded-lg max-w-[85%] ${
                            msg.sender_type === 'user' ? 'bg-muted' :
                            msg.sender_type === 'ai' ? 'bg-secondary' : 'bg-primary text-primary-foreground'
                          }`}>
                            <div className="flex items-center gap-1 text-xs mb-1 opacity-70">
                              {msg.sender_type === 'user' ? <User className="h-3 w-3" /> : 
                               msg.sender_type === 'ai' ? <Bot className="h-3 w-3" /> : 
                               <CheckCircle className="h-3 w-3" />}
                              <span className="capitalize">{msg.sender_type}</span>
                              <span className="text-xs opacity-50 ml-2">
                                {format(new Date(msg.created_at), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Admin Reply</Label>
                    <Textarea
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      placeholder="Type your response..."
                      rows={3}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={() => {
                          sendReplyMutation.mutate();
                        }}
                        disabled={!adminReply.trim() || sendReplyMutation.isPending}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Send Reply
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          closeTicketMutation.mutate(selectedTicket.id);
                          setDetailSheetOpen(false);
                        }}
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Close Ticket
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="faqs" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>FAQ Articles</CardTitle>
                <CardDescription>Manage frequently asked questions</CardDescription>
              </div>
              <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingFaq(null); setFaqForm({ category: '', question: '', answer: '', display_order: 0 }); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add FAQ
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add New FAQ'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={faqForm.category} onValueChange={(v) => setFaqForm({ ...faqForm, category: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {FAQ_CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Display Order</Label>
                        <Input
                          type="number"
                          value={faqForm.display_order}
                          onChange={(e) => setFaqForm({ ...faqForm, display_order: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input
                        value={faqForm.question}
                        onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                        placeholder="Enter the question"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Answer (Markdown supported)</Label>
                      <Textarea
                        value={faqForm.answer}
                        onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                        placeholder="Enter the detailed answer..."
                        rows={8}
                      />
                    </div>
                    <Button 
                      onClick={() => saveFaqMutation.mutate()}
                      disabled={!faqForm.category || !faqForm.question || !faqForm.answer}
                    >
                      {editingFaq ? 'Update FAQ' : 'Create FAQ'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {faqs?.map((faq) => (
                  <div key={faq.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="capitalize">{faq.category}</Badge>
                        <span className="font-medium truncate">{faq.question}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{faq.answer.slice(0, 100)}...</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => openEditFaq(faq)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteFaqMutation.mutate(faq.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Articles Tab */}
        <TabsContent value="articles" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Help Articles</CardTitle>
                <CardDescription>Manage support articles with feedback tracking</CardDescription>
              </div>
              <Dialog open={articleDialogOpen} onOpenChange={setArticleDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { 
                    setEditingArticle(null); 
                    setArticleForm({ 
                      slug: '', 
                      title: '', 
                      description: '', 
                      content: '', 
                      icon_name: 'BookOpen', 
                      display_order: 0, 
                      is_active: true 
                    }); 
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Article
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingArticle ? 'Edit Article' : 'Add New Article'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={articleForm.title}
                          onChange={(e) => {
                            const title = e.target.value;
                            setArticleForm({ 
                              ...articleForm, 
                              title, 
                              slug: editingArticle ? articleForm.slug : generateSlug(title) 
                            });
                          }}
                          placeholder="Article title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input
                          value={articleForm.slug}
                          onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })}
                          placeholder="url-friendly-slug"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <Select value={articleForm.icon_name} onValueChange={(v) => setArticleForm({ ...articleForm, icon_name: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select icon" />
                          </SelectTrigger>
                          <SelectContent>
                            {ICON_OPTIONS.map((icon) => (
                              <SelectItem key={icon.value} value={icon.value}>{icon.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Display Order</Label>
                        <Input
                          type="number"
                          value={articleForm.display_order}
                          onChange={(e) => setArticleForm({ ...articleForm, display_order: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Active</Label>
                        <div className="flex items-center gap-2 h-10">
                          <Switch
                            checked={articleForm.is_active}
                            onCheckedChange={(checked) => setArticleForm({ ...articleForm, is_active: checked })}
                          />
                          <span className="text-sm text-muted-foreground">
                            {articleForm.is_active ? 'Visible' : 'Hidden'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={articleForm.description}
                        onChange={(e) => setArticleForm({ ...articleForm, description: e.target.value })}
                        placeholder="Short description for the article card"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Content (Markdown supported)</Label>
                      <Textarea
                        value={articleForm.content}
                        onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                        placeholder="Full article content in Markdown format..."
                        rows={12}
                      />
                    </div>
                    <Button 
                      onClick={handleSaveArticle}
                      disabled={!articleForm.title || !articleForm.slug || !articleForm.description || !articleForm.content || createArticle.isPending || updateArticle.isPending}
                    >
                      {editingArticle ? 'Update Article' : 'Create Article'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {articlesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading articles...</div>
                ) : articles?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No articles yet</p>
                  </div>
                ) : (
                  articles?.map((article) => (
                    <div key={article.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={article.is_active ? "default" : "secondary"}>
                            {article.is_active ? 'Active' : 'Hidden'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">#{article.display_order}</span>
                          <span className="font-medium truncate">{article.title}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="truncate">{article.description.slice(0, 60)}...</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="flex items-center gap-1 text-green-600">
                              <ThumbsUp className="h-3 w-3" />
                              {article.helpful_count}
                            </span>
                            <span className="flex items-center gap-1 text-red-500">
                              <ThumbsDown className="h-3 w-3" />
                              {article.not_helpful_count}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => openEditArticle(article)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => deleteArticle.mutate(article.id)}
                          disabled={deleteArticle.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupportDashboard;
