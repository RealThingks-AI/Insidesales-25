import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Type, Image, Save, RefreshCw, Upload, RotateCcw, Info } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BrandingData {
  id: string;
  app_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
}

const fontOptions = [
  { value: 'Inter', label: 'Inter (Default)' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
];

const defaultBranding = {
  app_name: 'CRM',
  logo_url: null,
  favicon_url: null,
  primary_color: '#0284c7',
  secondary_color: '#334155',
  accent_color: '#f8fafc',
  font_family: 'Inter',
};

const BrandingSettings = () => {
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { refreshBranding } = useBranding();

  const fetchBranding = async () => {
    try {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setBranding(data);
      } else {
        // Create default branding settings
        const { data: newData, error: insertError } = await supabase
          .from('branding_settings')
          .insert({})
          .select()
          .single();
        
        if (insertError) throw insertError;
        setBranding(newData);
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
      toast.error('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleSave = async () => {
    if (!branding) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('branding_settings')
        .update({
          app_name: branding.app_name,
          logo_url: branding.logo_url,
          favicon_url: branding.favicon_url,
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          accent_color: branding.accent_color,
          font_family: branding.font_family,
        })
        .eq('id', branding.id);

      if (error) throw error;

      // Refresh branding context to apply changes immediately
      await refreshBranding();
      
      toast.success('Branding settings saved and applied successfully');
    } catch (error) {
      console.error('Error saving branding:', error);
      toast.error('Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!branding) return;

    setBranding({
      ...branding,
      ...defaultBranding,
    });
    toast.info('Settings reset to default. Click "Save Changes" to apply.');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setBranding(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const updateField = (field: keyof BrandingData, value: string) => {
    setBranding(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Branding Settings</h3>
            <p className="text-sm text-muted-foreground">
              Customize your CRM's appearance and branding
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleResetToDefault}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* App Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                App Identity
              </CardTitle>
              <CardDescription>Set your app name and logo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="app-name">App Name</Label>
                <Input
                  id="app-name"
                  value={branding?.app_name || ''}
                  onChange={(e) => updateField('app_name', e.target.value)}
                  placeholder="My CRM"
                />
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {branding?.logo_url ? (
                    <img 
                      src={branding.logo_url} 
                      alt="Logo" 
                      className="h-12 w-12 object-contain rounded border"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-muted rounded border flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                        <Upload className="h-4 w-4" />
                        {uploading ? 'Uploading...' : 'Upload Logo'}
                      </div>
                    </Label>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo-url">Or enter Logo URL</Label>
                <Input
                  id="logo-url"
                  value={branding?.logo_url || ''}
                  onChange={(e) => updateField('logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Typography
              </CardTitle>
              <CardDescription>Choose your font family</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select
                  value={branding?.font_family || 'Inter'}
                  onValueChange={(value) => updateField('font_family', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fontOptions.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <p style={{ fontFamily: branding?.font_family }} className="text-lg font-semibold">
                  The quick brown fox jumps over the lazy dog
                </p>
                <p style={{ fontFamily: branding?.font_family }} className="text-sm">
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Scheme
              </CardTitle>
              <CardDescription>Customize your brand colors. Changes will be applied globally after saving.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="primary-color">Primary Color</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Used for buttons, links, and main interactive elements</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="primary-color"
                      value={branding?.primary_color || '#0284c7'}
                      onChange={(e) => updateField('primary_color', e.target.value)}
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={branding?.primary_color || '#0284c7'}
                      onChange={(e) => updateField('primary_color', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="secondary-color">Secondary Color</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Used for secondary buttons and less prominent elements</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="secondary-color"
                      value={branding?.secondary_color || '#334155'}
                      onChange={(e) => updateField('secondary_color', e.target.value)}
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={branding?.secondary_color || '#334155'}
                      onChange={(e) => updateField('secondary_color', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accent-color">Accent Color</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Used for highlights and accent elements</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="accent-color"
                      value={branding?.accent_color || '#f8fafc'}
                      onChange={(e) => updateField('accent_color', e.target.value)}
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={branding?.accent_color || '#f8fafc'}
                      onChange={(e) => updateField('accent_color', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Enhanced Color Preview */}
              <div className="mt-6 p-4 border rounded-lg space-y-4">
                <p className="text-sm font-medium text-foreground">Live Preview:</p>
                
                {/* Color Swatches */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div 
                    className="h-12 w-24 rounded flex items-center justify-center text-white text-sm font-medium shadow-sm"
                    style={{ backgroundColor: branding?.primary_color }}
                  >
                    Primary
                  </div>
                  <div 
                    className="h-12 w-24 rounded flex items-center justify-center text-white text-sm font-medium shadow-sm"
                    style={{ backgroundColor: branding?.secondary_color }}
                  >
                    Secondary
                  </div>
                  <div 
                    className="h-12 w-24 rounded border flex items-center justify-center text-sm font-medium shadow-sm"
                    style={{ backgroundColor: branding?.accent_color }}
                  >
                    Accent
                  </div>
                </div>

                {/* Button Preview */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Button Preview:</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      className="px-4 py-2 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: branding?.primary_color }}
                    >
                      Primary Button
                    </button>
                    <button
                      className="px-4 py-2 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: branding?.secondary_color }}
                    >
                      Secondary Button
                    </button>
                    <button
                      className="px-4 py-2 rounded-md text-sm font-medium border transition-colors hover:opacity-90"
                      style={{ 
                        backgroundColor: branding?.accent_color,
                        borderColor: branding?.primary_color,
                        color: branding?.primary_color 
                      }}
                    >
                      Outline Button
                    </button>
                  </div>
                </div>

                {/* Card Preview */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Card Preview:</p>
                  <div 
                    className="p-4 rounded-lg border max-w-xs"
                    style={{ 
                      backgroundColor: branding?.accent_color,
                      borderColor: branding?.primary_color + '30'
                    }}
                  >
                    <h4 
                      className="font-semibold mb-1"
                      style={{ color: branding?.primary_color }}
                    >
                      Sample Card Title
                    </h4>
                    <p 
                      className="text-sm"
                      style={{ color: branding?.secondary_color }}
                    >
                      This is how a card might look with your selected colors.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default BrandingSettings;