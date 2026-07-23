import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { User, Mail, Phone, Calendar, Save, ArrowLeft, Camera, Trophy } from 'lucide-react';
import { useBadgeSummary } from '@/hooks/useStudentBadges';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNav } from '@/components/mobile/BottomNav';

const Profile = () => {
  const navigate = useNavigate();
  const { data: userData, isLoading, refetch } = useCurrentUser();
  const [isSaving, setIsSaving] = useState(false);
  const isMobile = useIsMobile();
  const { summary: badgeSummary } = useBadgeSummary();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
  });

  useEffect(() => {
    if (userData?.profile) {
      setFormData({
        fullName: userData.profile.full_name || '',
        phone: userData.profile.phone_number || '',
        dateOfBirth: userData.profile.date_of_birth || '',
      });
    }
  }, [userData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData?.id) {
      toast.error('Please login to update profile');
      navigate('/auth');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone_number: formData.phone,
          date_of_birth: formData.dateOfBirth || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      refetch();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {!isMobile && <DashboardHeader />}
        <main className="flex-1 container mx-auto px-4 py-12">
          <Skeleton className="h-96 mb-8" />
        </main>
        {isMobile ? <BottomNav /> : <Footer />}
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex flex-col">
        {!isMobile && <DashboardHeader />}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Please Login</h1>
            <Button onClick={() => navigate('/auth')}>Go to Login</Button>
          </div>
        </main>
        {isMobile ? <BottomNav /> : <Footer />}
      </div>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col">
        <SEOHead
          title="My Profile | SimpleLecture"
          description="Manage your profile settings"
        />
        
        {/* Mobile Header with Avatar */}
        <div className="bg-gradient-to-br from-primary via-primary to-primary px-4 pt-10 pb-16 rounded-b-[2rem]">
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-white text-lg font-bold">My Profile</h1>
          </div>
          
          {/* Centered Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                <AvatarImage src={userData.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-white text-primary">
                  {userData.profile?.full_name?.charAt(0) || userData.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button 
                size="icon" 
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-white text-primary hover:bg-gray-100 shadow-md"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-white text-xl font-bold mt-3">{userData.profile?.full_name || 'User'}</h2>
            <p className="text-white/80 text-sm">{userData.email}</p>
          </div>
        </div>

        {/* Profile Form */}
        <main className="flex-1 bg-background px-4 -mt-8 pb-24">
          {/* Badge Summary */}
          <Card className="border-0 shadow-lg mb-4 cursor-pointer" onClick={() => navigate('/my-rewards')}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-semibold">My Badges</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>🥈 {badgeSummary.silver}</span>
                  <span>🥉 {badgeSummary.bronze}</span>
                  <span>🥇 {badgeSummary.gold}</span>
                  <span>⭐ {badgeSummary.master}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="flex items-center gap-2 text-sm text-muted-foreground mb-1.5">
                    <User className="h-4 w-4" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter your full name"
                    className="h-11"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2 text-sm text-muted-foreground mb-1.5">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={userData.email || ''}
                    disabled
                    className="bg-muted h-11"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2 text-sm text-muted-foreground mb-1.5">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="h-11"
                  />
                </div>

                <div>
                  <Label htmlFor="dateOfBirth" className="flex items-center gap-2 text-sm text-muted-foreground mb-1.5">
                    <Calendar className="h-4 w-4" />
                    Date of Birth
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-primary hover:bg-primary mt-4"
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>

        <BottomNav />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title="My Profile | SimpleLecture"
        description="Manage your profile settings"
      />
      <DashboardHeader />

      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            {/* Profile Header */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={userData.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl">
                      {userData.profile?.full_name?.charAt(0) || userData.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-3xl font-bold">{userData.profile?.full_name || 'User'}</h1>
                    <p className="text-muted-foreground">{userData.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Badge Summary */}
            <Card className="mb-6 cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/my-rewards')}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold">My Rewards</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>🥈 {badgeSummary.silver}</span>
                    <span>🥉 {badgeSummary.bronze}</span>
                    <span>🥇 {badgeSummary.gold}</span>
                    <span>⭐ {badgeSummary.master}</span>
                    <span>🎓 {badgeSummary.course_complete}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Form */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="fullName" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={userData.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date of Birth
                    </Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;
