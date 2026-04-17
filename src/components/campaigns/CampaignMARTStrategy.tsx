import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, ChevronsUpDown, Mail, Phone, MessageSquare, FileText, Users, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CampaignMARTMessage } from "./CampaignMARTMessage";
import { CampaignMARTAudience } from "./CampaignMARTAudience";
import { CampaignMARTRegion } from "./CampaignMARTRegion";
import { CampaignMARTTiming } from "./CampaignMARTTiming";
import type { Campaign } from "@/hooks/useCampaigns";

interface Props {
  campaignId: string;
  campaign: Campaign;
  isMARTComplete: { message: boolean; audience: boolean; region: boolean; timing: boolean };
  updateMartFlag: (flag: string, value: boolean) => Promise<void>;
  isCampaignEnded: boolean;
  daysRemaining: number | null;
  timingNotes?: string | null;
  contentCounts?: {
    emailTemplateCount: number;
    phoneScriptCount: number;
    linkedinTemplateCount: number;
    materialCount: number;
    regionCount: number;
    hasAudienceData: boolean;
  };
}

function parseAudienceHasContent(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.job_titles?.length || parsed.departments?.length || parsed.seniorities?.length || parsed.industries?.length || parsed.company_sizes?.length) return true;
    if (Array.isArray(parsed) && parsed.length > 0) return true;
  } catch {}
  return false;
}

function parseRegionCount(raw: string | null): number {
  if (!raw) return 0;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.length;
  } catch {}
  return raw ? 1 : 0;
}

export function CampaignMARTStrategy({ campaignId, campaign, isMARTComplete, updateMartFlag, isCampaignEnded, daysRemaining, timingNotes, contentCounts }: Props) {
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    message: true, audience: false, region: false, timing: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const allOpen = Object.values(openSections).every(Boolean);
    const newState = { message: !allOpen, audience: !allOpen, region: !allOpen, timing: !allOpen };
    setOpenSections(newState);
  };

  const validateSection = (key: string): string | null => {
    const counts = contentCounts;
    switch (key) {
      case "message":
        if (counts && counts.emailTemplateCount === 0 && counts.phoneScriptCount === 0 && counts.linkedinTemplateCount === 0)
          return "Add at least 1 email template, call script, or LinkedIn message before marking Message as done.";
        return null;
      case "audience":
        if (!parseAudienceHasContent(campaign.target_audience))
          return "Define at least one audience criteria (job titles, departments, etc.) before marking Audience as done.";
        return null;
      case "region":
        if (parseRegionCount(campaign.region) === 0)
          return "Add at least 1 region before marking Region as done.";
        return null;
      case "timing":
        if (!campaign.start_date || !campaign.end_date)
          return "Set campaign start and end dates before marking Timing as done.";
        return null;
      default:
        return null;
    }
  };

  const handleMarkDone = async (flag: string, label: string, key: string) => {
    const validationError = validateSection(key);
    if (validationError) {
      toast.warning(validationError);
      return;
    }
    await updateMartFlag(flag, true);
    toast.success(`${label} marked as done`);
  };

  const handleUnmark = async (flag: string, label: string) => {
    await updateMartFlag(flag, false);
    toast.info(`${label} unmarked`);
  };

  const handleSaveTimingNotes = async (notes: string) => {
    if (!campaignId) return;
    const { data: existing } = await supabase.from("campaign_mart").select("campaign_id").eq("campaign_id", campaignId).maybeSingle();
    if (existing) {
      await supabase.from("campaign_mart").update({ timing_notes: notes }).eq("campaign_id", campaignId);
    } else {
      await supabase.from("campaign_mart").insert({ campaign_id: campaignId, timing_notes: notes });
    }
    queryClient.invalidateQueries({ queryKey: ["campaign-mart", campaignId] });
    toast.success("Timing note saved");
  };

  const completedCount = [isMARTComplete.message, isMARTComplete.audience, isMARTComplete.region, isMARTComplete.timing].filter(Boolean).length;
  const progressPercent = (completedCount / 4) * 100;

  const getContentSummary = (key: string): string => {
    if (!contentCounts) return "";
    switch (key) {
      case "message": {
        const parts: string[] = [];
        if (contentCounts.emailTemplateCount > 0) parts.push(`${contentCounts.emailTemplateCount} email${contentCounts.emailTemplateCount > 1 ? "s" : ""}`);
        if (contentCounts.phoneScriptCount > 0) parts.push(`${contentCounts.phoneScriptCount} script${contentCounts.phoneScriptCount > 1 ? "s" : ""}`);
        if (contentCounts.linkedinTemplateCount > 0) parts.push(`${contentCounts.linkedinTemplateCount} LinkedIn`);
        if (contentCounts.materialCount > 0) parts.push(`${contentCounts.materialCount} file${contentCounts.materialCount > 1 ? "s" : ""}`);
        return parts.join(", ");
      }
      case "audience":
        return contentCounts.hasAudienceData ? "Configured" : "Not configured";
      case "region": {
        const rc = parseRegionCount(campaign.region);
        return rc > 0 ? `${rc} region${rc > 1 ? "s" : ""}` : "No regions";
      }
      case "timing":
        return campaign.start_date && campaign.end_date ? `${campaign.start_date} → ${campaign.end_date}` : "Dates not set";
      default:
        return "";
    }
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    message: <Mail className="h-4 w-4" />,
    audience: <Users className="h-4 w-4" />,
    region: <Globe className="h-4 w-4" />,
    timing: <Clock className="h-4 w-4" />,
  };

  const sections = [
    { key: "message", label: "Message", flag: "message_done", done: isMARTComplete.message },
    { key: "audience", label: "Audience", flag: "audience_done", done: isMARTComplete.audience },
    { key: "region", label: "Region", flag: "region_done", done: isMARTComplete.region },
    { key: "timing", label: "Timing", flag: "timing_done", done: isMARTComplete.timing },
  ];

  return (
    <div className="space-y-3">
      {/* Overall MART Progress — compact single row */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <h3 className="font-semibold text-sm">MART</h3>
              <Badge variant={completedCount === 4 ? "default" : "secondary"} className="text-xs">
                {completedCount}/4
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-2 flex-1" />
            <div className="flex items-center gap-2 shrink-0">
              {sections.map((s) => (
                <div key={s.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                  {s.done ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Circle className="h-3 w-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 shrink-0" onClick={toggleAll}>
              <ChevronsUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{Object.values(openSections).every(Boolean) ? "Collapse" : "Expand"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <Card key={section.key} className={`border-l-4 ${section.done ? "border-l-green-500" : "border-l-muted-foreground/30"}`}>
          <Collapsible open={openSections[section.key]} onOpenChange={() => toggleSection(section.key)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-2.5 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {openSections[section.key] ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    {section.done ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                    {sectionIcons[section.key]}
                    <CardTitle className="text-sm">{section.label}</CardTitle>
                    {section.done && <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">Done</Badge>}
                    {(() => {
                      const summary = getContentSummary(section.key);
                      return summary ? (
                        <span className="text-xs text-muted-foreground ml-1 truncate">· {summary}</span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {section.done ? (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleUnmark(section.flag, section.label)}>Unmark</Button>
                    ) : (
                      <Button size="sm" className="text-xs h-7" onClick={() => handleMarkDone(section.flag, section.label, section.key)}>Mark Done</Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 px-4 pb-4">
                {section.key === "message" && <CampaignMARTMessage campaignId={campaignId} />}
                {section.key === "audience" && <CampaignMARTAudience campaign={campaign} />}
                {section.key === "region" && <CampaignMARTRegion campaign={campaign} />}
                {section.key === "timing" && (
                  <CampaignMARTTiming
                    campaign={campaign}
                    isCampaignEnded={isCampaignEnded}
                    daysRemaining={daysRemaining}
                    timingNotes={timingNotes}
                    onSaveTimingNotes={handleSaveTimingNotes}
                  />
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
