import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampaigns, type Campaign } from "@/hooks/useCampaigns";
import { useState, useEffect, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Briefcase, Building2, X, Trash2, Save, Target, CheckCircle2, AlertCircle, UserPlus, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AudienceData {
  job_titles: string[];
  departments: string[];
  seniorities: string[];
  industries: string[];
  company_sizes: string[];
}

const DEPARTMENTS = ["Sales", "Marketing", "Operations", "Engineering", "Finance", "HR", "Other"];
const SENIORITIES = ["C-Suite", "VP", "Director", "Manager", "Team Lead", "Individual Contributor"];
const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1000", "1000+"];

function parseAudience(raw: string | null): AudienceData {
  const empty: AudienceData = { job_titles: [], departments: [], seniorities: [], industries: [], company_sizes: [] };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.job_titles) return { ...empty, ...parsed };
    if (Array.isArray(parsed)) {
      const first = parsed[0] || {};
      return {
        job_titles: first.job_title ? [first.job_title] : [],
        departments: first.department ? [first.department] : [],
        seniorities: first.seniority ? [first.seniority] : [],
        industries: first.industry ? [first.industry] : [],
        company_sizes: first.company_size ? [first.company_size] : [],
      };
    }
  } catch {}
  return empty;
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) onChange([...tags, input.trim()]);
      setInput("");
    }
  };
  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag));

  return (
    <div className="space-y-1">
      <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="h-8 text-sm" />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs py-0 px-1.5">
              {tag}
              <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckboxGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (selected: string[]) => void }) {
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-foreground transition-colors">
          <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} className="h-3.5 w-3.5" />
          <span className="text-xs">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function SectionStatus({ filled }: { filled: boolean }) {
  return filled ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
  ) : (
    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
  );
}

interface Props {
  campaign: Campaign;
}

export function CampaignMARTAudience({ campaign }: Props) {
  const { updateCampaign } = useCampaigns();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [data, setData] = useState<AudienceData>(() => parseAudience(campaign.target_audience));
  const [saving, setSaving] = useState(false);
  const [personaName, setPersonaName] = useState("");
  const [showSavePersona, setShowSavePersona] = useState(false);

  useEffect(() => {
    setData(parseAudience(campaign.target_audience));
  }, [campaign.target_audience]);

  // Fetch personas
  const { data: personas = [] } = useQuery({
    queryKey: ["audience-personas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_audience_personas" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Save persona mutation
  const savePersona = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("campaign_audience_personas" as any).insert({
        persona_name: name,
        criteria: data as any,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience-personas"] });
      setPersonaName("");
      setShowSavePersona(false);
      toast({ title: "Persona saved", description: "Audience persona saved successfully." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save persona." });
    },
  });

  const handleLoadPersona = (personaId: string) => {
    const persona = personas.find((p: any) => p.id === personaId);
    if (persona?.criteria) {
      const criteria = typeof persona.criteria === "string" ? JSON.parse(persona.criteria) : persona.criteria;
      setData({ job_titles: [], departments: [], seniorities: [], industries: [], company_sizes: [], ...criteria });
      toast({ title: "Persona loaded", description: `Loaded "${persona.persona_name}" criteria.` });
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    await supabase.from("campaign_audience_personas" as any).delete().eq("id", personaId);
    queryClient.invalidateQueries({ queryKey: ["audience-personas"] });
    toast({ title: "Persona deleted" });
  };

  const handleSave = () => {
    setSaving(true);
    updateCampaign.mutate(
      { id: campaign.id, target_audience: JSON.stringify(data) },
      { onSettled: () => setSaving(false) }
    );
  };

  const handleClearAll = () => {
    setData({ job_titles: [], departments: [], seniorities: [], industries: [], company_sizes: [] });
  };

  const whoFilled = data.job_titles.length > 0 || data.seniorities.length > 0 || data.departments.length > 0;
  const whereFilled = data.industries.length > 0 || data.company_sizes.length > 0;

  const criteriaCount = [
    data.job_titles.length > 0,
    data.departments.length > 0,
    data.seniorities.length > 0,
    data.industries.length > 0,
    data.company_sizes.length > 0,
  ].filter(Boolean).length;

  const hasContent = criteriaCount > 0;

  // Build summary
  const summaryParts: string[] = [];
  if (data.seniorities.length) summaryParts.push(data.seniorities.join(", "));
  if (data.job_titles.length) summaryParts.push(data.job_titles.join(", "));
  if (data.departments.length) summaryParts.push(`in ${data.departments.join(", ")}`);
  if (data.industries.length) summaryParts.push(`from ${data.industries.join(", ")}`);
  if (data.company_sizes.length) summaryParts.push(`(${data.company_sizes.join(" / ")} employees)`);
  const summary = summaryParts.length > 0 ? `Targeting ${summaryParts.join(" ")}` : "";

  return (
    <div className="space-y-3">
      {/* Persona Load/Save Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {personas.length > 0 && (
          <div className="flex items-center gap-2">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <Select onValueChange={handleLoadPersona}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Load persona..." />
              </SelectTrigger>
              <SelectContent>
                {personas.map((p: any) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.persona_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {hasContent && !showSavePersona && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowSavePersona(true)}>
            <UserPlus className="h-3 w-3" /> Save as Persona
          </Button>
        )}
        {showSavePersona && (
          <div className="flex items-center gap-1.5">
            <Input
              value={personaName}
              onChange={e => setPersonaName(e.target.value)}
              placeholder="Persona name..."
              className="h-8 w-[180px] text-xs"
              onKeyDown={e => { if (e.key === "Enter" && personaName.trim()) savePersona.mutate(personaName.trim()); }}
            />
            <Button size="sm" className="h-8 text-xs" disabled={!personaName.trim()} onClick={() => savePersona.mutate(personaName.trim())}>
              Save
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowSavePersona(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Summary card when content exists */}
      {hasContent && (
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="py-2.5 px-3">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium">Audience Profile</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{criteriaCount}/5 criteria</Badge>
                </div>
                <p className="text-xs text-muted-foreground italic truncate">{summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="p-3 border border-dashed rounded-lg text-center">
          <Users className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Define your ideal customer profile by filling in criteria below.</p>
          {personas.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Or load a saved persona above to get started quickly.</p>
          )}
        </div>
      )}

      {/* Two sections: WHO and WHERE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* WHO section */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Briefcase className="h-3.5 w-3.5" />
            Who — Role & Seniority
            <SectionStatus filled={whoFilled} />
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs mb-1 block">Job Titles <span className="text-[10px] text-muted-foreground">(type + Enter)</span></Label>
              <TagInput tags={data.job_titles} onChange={tags => setData({ ...data, job_titles: tags })} placeholder="e.g. CEO, VP of Sales..." />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Seniority</Label>
              <CheckboxGroup options={SENIORITIES} selected={data.seniorities} onChange={sens => setData({ ...data, seniorities: sens })} />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Departments</Label>
              <CheckboxGroup options={DEPARTMENTS} selected={data.departments} onChange={deps => setData({ ...data, departments: deps })} />
            </div>
          </div>
        </div>

        {/* WHERE section */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5" />
            Where — Industry & Size
            <SectionStatus filled={whereFilled} />
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs mb-1 block">Industries <span className="text-[10px] text-muted-foreground">(type + Enter)</span></Label>
              <TagInput tags={data.industries} onChange={tags => setData({ ...data, industries: tags })} placeholder="e.g. SaaS, FinTech, Manufacturing..." />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Company Sizes</Label>
              <CheckboxGroup options={COMPANY_SIZES} selected={data.company_sizes} onChange={sizes => setData({ ...data, company_sizes: sizes })} />
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={saving || !hasContent}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save Audience"}
        </Button>
        {hasContent && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1" onClick={handleClearAll}>
            <Trash2 className="h-3 w-3" /> Clear All
          </Button>
        )}
        {!hasContent && (
          <span className="text-xs text-muted-foreground">Add at least one criteria to save</span>
        )}
      </div>
    </div>
  );
}
