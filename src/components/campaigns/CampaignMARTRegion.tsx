import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampaigns, type Campaign } from "@/hooks/useCampaigns";
import { useState, useMemo, useEffect } from "react";
import { Globe, Plus, Pencil, Trash2 } from "lucide-react";
import { regions, countries, countryToRegion, getCountriesForRegion, getFormattedTimezoneList, getTimezonesForCountry, getTimezoneLabel } from "@/utils/countryRegionMapping";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface RegionCard {
  country: string;
  region: string;
  timezone: string;
  messaging_note: string;
}

function parseRegions(campaign: Campaign): RegionCard[] {
  if (campaign.region) {
    try {
      const arr = JSON.parse(campaign.region);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {}
  }
  if (campaign.country || campaign.region) {
    const tz = campaign.notes?.match(/\[timezone:(.+?)\]/)?.[1] || "";
    return [{ country: campaign.country || "", region: (campaign.region && !campaign.region.startsWith("[")) ? campaign.region : "", timezone: tz, messaging_note: "" }];
  }
  return [];
}

interface Props {
  campaign: Campaign;
}

export function CampaignMARTRegion({ campaign }: Props) {
  const { updateCampaign } = useCampaigns();
  const [regionCards, setRegionCards] = useState<RegionCard[]>(() => parseRegions(campaign));
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RegionCard>({ country: "", region: "", timezone: "", messaging_note: "" });
  const [saving, setSaving] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  // Sync state when campaign.region changes externally
  useEffect(() => {
    setRegionCards(parseRegions(campaign));
  }, [campaign.region]);

  const filteredCountries = useMemo(() => {
    if (!form.region) return countries;
    return getCountriesForRegion(form.region);
  }, [form.region]);

  const filteredTimezones = useMemo(() => {
    if (form.country) return getTimezonesForCountry(form.country);
    return getFormattedTimezoneList();
  }, [form.country]);

  const openAdd = () => {
    setForm({ country: "", region: "", timezone: "", messaging_note: "" });
    setEditIndex(null);
    setFormOpen(true);
  };

  const openEdit = (i: number) => {
    setForm({ ...regionCards[i] });
    setEditIndex(i);
    setFormOpen(true);
  };

  const handleRegionChange = (value: string) => {
    const newForm = { ...form, region: value };
    if (form.country && countryToRegion[form.country] !== value) {
      newForm.country = "";
    }
    setForm(newForm);
  };

  const handleCountryChange = (value: string) => {
    const newForm = { ...form, country: value };
    const region = countryToRegion[value];
    if (region) {
      newForm.region = region;
    }
    const validTzs = getTimezonesForCountry(value);
    if (!newForm.timezone || !validTzs.some(tz => tz.value === newForm.timezone)) {
      newForm.timezone = validTzs.length === 1 ? validTzs[0].value : "";
    }
    setForm(newForm);
  };

  const saveCard = () => {
    if (!form.region) return;
    const updated = [...regionCards];
    if (editIndex !== null) { updated[editIndex] = form; } else { updated.push(form); }
    setRegionCards(updated);
    setFormOpen(false);
    persistRegions(updated);
  };

  const confirmDeleteCard = (i: number) => {
    setDeleteIndex(i);
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex === null) return;
    const updated = regionCards.filter((_, idx) => idx !== deleteIndex);
    setRegionCards(updated);
    persistRegions(updated);
    setDeleteIndex(null);
  };

  const persistRegions = (regs: RegionCard[]) => {
    setSaving(true);
    let notes = campaign.notes || "";
    notes = notes.replace(/\[timezone:.+?\]\s*/g, "").trim();
    updateCampaign.mutate(
      { id: campaign.id, region: JSON.stringify(regs), country: regs[0]?.country || null, notes },
      { onSettled: () => setSaving(false) }
    );
  };

  const getTimezoneDisplay = (tz: string) => {
    return getTimezoneLabel(tz);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <h4 className="text-sm font-medium">Region Targeting</h4>
        </div>
        <Button variant="outline" size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Region</Button>
      </div>

      {regionCards.length === 0 && !formOpen && (
        <p className="text-sm text-muted-foreground">No regions defined yet. Add regions to specify geographic targeting.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {regionCards.map((r, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{r.region}{r.country ? ` — ${r.country}` : ""}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => confirmDeleteCard(i)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
              </div>
            </div>
            {r.timezone && <p className="text-xs text-muted-foreground">{getTimezoneDisplay(r.timezone)}</p>}
            {r.messaging_note && <p className="text-xs text-muted-foreground italic mt-1">{r.messaging_note}</p>}
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Region *</Label>
              <Select value={form.region} onValueChange={handleRegionChange}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select region..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <Select value={form.country} onValueChange={handleCountryChange}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select country..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredCountries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timezone</Label>
              <Select value={form.timezone} onValueChange={v => setForm({ ...form, timezone: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select timezone..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredTimezones.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Messaging Note</Label>
            <Textarea value={form.messaging_note} onChange={e => setForm({ ...form, messaging_note: e.target.value })} placeholder="Region-specific messaging variations..." rows={2} className="text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveCard} disabled={!form.region}>{editIndex !== null ? "Update" : "Add"}</Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this region?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIndex !== null && regionCards[deleteIndex] && (
                <>Remove "{regionCards[deleteIndex].region}{regionCards[deleteIndex].country ? ` — ${regionCards[deleteIndex].country}` : ""}"? This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
