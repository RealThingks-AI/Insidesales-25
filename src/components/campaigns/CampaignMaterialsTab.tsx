import { useRef, useState } from 'react';
import { useCampaignMaterials } from '@/hooks/useCampaigns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { MATERIAL_TYPES } from '@/types/campaign';
import { useToast } from '@/hooks/use-toast';

interface Props {
  campaignId: string;
}

export function CampaignMaterialsTab({ campaignId }: Props) {
  const { query, uploadMaterial, deleteMaterial } = useCampaignMaterials(campaignId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState('One Pager');
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadMaterial.mutateAsync({ file, fileType });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('campaign-materials').createSignedUrl(filePath, 3600);
      if (error) throw error;
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Materials ({query.data?.length || 0})</span>
        <div className="flex items-center gap-2">
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MATERIAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadMaterial.isPending}>
            <Upload className="h-3 w-3 mr-1" /> Upload
          </Button>
        </div>
      </div>

      {!query.data?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No materials uploaded yet</p>
      ) : (
        <div className="space-y-2">
          {query.data.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.file_name}</p>
                  <p className="text-xs text-muted-foreground">{m.file_type || 'Document'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Download"
                  onClick={() => handleDownload(m.file_path, m.file_name)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteMaterial.mutate({ id: m.id, filePath: m.file_path })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
