import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Mail, Phone, Globe, Loader2 } from 'lucide-react';

const timezones = [
  { value: 'Asia/Kolkata', label: 'IST (India Standard Time)' },
  { value: 'America/New_York', label: 'EST (Eastern Standard Time)' },
  { value: 'America/Los_Angeles', label: 'PST (Pacific Standard Time)' },
  { value: 'Europe/London', label: 'GMT (Greenwich Mean Time)' },
  { value: 'Europe/Paris', label: 'CET (Central European Time)' },
  { value: 'Asia/Tokyo', label: 'JST (Japan Standard Time)' },
  { value: 'Asia/Singapore', label: 'SGT (Singapore Time)' },
  { value: 'Australia/Sydney', label: 'AEST (Australian Eastern Time)' },
  { value: 'Asia/Dubai', label: 'GST (Gulf Standard Time)' }
];

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  timezone: string;
  avatar_url: string;
}

const ProfileSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    timezone: 'Asia/Kolkata',
    avatar_url: ''
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      setProfile({
        full_name: data?.full_name || user.user_metadata?.full_name || '',
        email: data?.['Email ID'] || user.email || '',
        phone: data?.phone || '',
        timezone: data?.timezone || 'Asia/Kolkata',
        avatar_url: data?.avatar_url || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: profile.full_name,
        'Email ID': profile.email,
        phone: profile.phone,
        timezone: profile.timezone,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Avatar + Name/Email */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="relative group">
              <Avatar className="h-16 w-16 cursor-pointer" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file && user) {
                    try {
                      const fileExt = file.name.split('.').pop();
                      const filePath = `${user.id}/avatar.${fileExt}`;
                      const { error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(filePath, file, { upsert: true });
                      if (uploadError) throw uploadError;
                      const { data: urlData } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(filePath);
                      setProfile(p => ({ ...p, avatar_url: urlData.publicUrl + '?t=' + Date.now() }));
                      toast.success('Profile picture updated');
                    } catch (error) {
                      console.error('Error uploading avatar:', error);
                      toast.error('Failed to upload profile picture');
                    }
                  }
                };
                input.click();
              }}>
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                <AvatarFallback className="text-sm">
                  {getInitials(profile.full_name || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <span className="text-white text-xs">Change</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">Click to change</p>
          </div>

          <div className="flex-1 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-xs">Full Name</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Enter your full name"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  readOnly
                  disabled
                  className="pl-8 h-9 bg-muted/50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Phone + Timezone */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                value={profile.phone}
                onChange={e => {
                  let value = e.target.value.replace(/[^\d+\s()-]/g, '');
                  setProfile(p => ({ ...p, phone: value }));
                }}
                placeholder="+1 234 567 8900"
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-xs">Timezone</Label>
            <div className="relative">
              <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
              <Select
                value={profile.timezone}
                onValueChange={value => setProfile(p => ({ ...p, timezone: value }))}
              >
                <SelectTrigger className="pl-8 h-9">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2 border-t flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSettings;
