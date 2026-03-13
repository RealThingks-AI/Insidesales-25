import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Database, Eye, Play, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CSVParser } from "@/utils/csvParser";

interface LinkSummary {
  totalContacts: number;
  alreadyLinked: number;
  willLink: number;
  noZohoMatch: number;
  noAccountLink: number;
  noCrmAccount: number;
  errors: number;
  matchedByEmail: number;
  matchedByName: number;
  dryRun: boolean;
  updatedCount: number;
  updateErrors: number;
  zohoStats: {
    totalAccounts: number;
    totalContacts: number;
    contactsWithAccountLink: number;
    contactsWithoutAccountLink: number;
  };
}

interface UnmatchedContact {
  contactName: string;
  email: string | null;
  status: string;
  zohoAccountName: string | null;
}

interface LinkResponse {
  success: boolean;
  summary: LinkSummary;
  unmatchedSample: UnmatchedContact[];
  error?: string;
}

type Step = "input" | "preview" | "executing" | "results";

const DataToolsSettings = () => {
  const [step, setStep] = useState<Step>("input");
  const [zohoAccountsCSV, setZohoAccountsCSV] = useState("");
  const [zohoContactsCSV, setZohoContactsCSV] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<LinkResponse | null>(null);
  const [finalResult, setFinalResult] = useState<LinkResponse | null>(null);

  const parseZohoAccounts = (csv: string) => {
    const { headers, rows } = CSVParser.parseCSV(csv);

    // Find column indices
    const idIdx = headers.findIndex(h => h.toLowerCase().includes("zcrm_id") || h.toLowerCase() === "id" || h.toLowerCase().includes("record id") || h.toLowerCase().includes("record_id"));
    const nameIdx = headers.findIndex(h =>
      h.toLowerCase().includes("account name") ||
      h.toLowerCase() === "account_name" ||
      h.toLowerCase() === "accountname"
    );

    if (idIdx === -1 || nameIdx === -1) {
      throw new Error(`Could not find required columns in Zoho Accounts CSV. Found headers: ${headers.join(", ")}. Need: zcrm_id/id, Account Name`);
    }

    return rows.map(row => ({
      zcrm_id: row[idIdx]?.trim() || "",
      accountName: row[nameIdx]?.trim() || "",
    })).filter(a => a.zcrm_id && a.accountName);
  };

  const parseZohoContacts = (csv: string) => {
    const { headers, rows } = CSVParser.parseCSV(csv);

    // Find column indices
    const nameIdx = headers.findIndex(h =>
      h.toLowerCase().includes("contact name") ||
      h.toLowerCase() === "contact_name" ||
      h.toLowerCase() === "full name" ||
      h.toLowerCase() === "full_name"
    );
    const accountIdIdx = headers.findIndex(h =>
      h.toLowerCase().includes("account name.id") ||
      h.toLowerCase().includes("account_name.id") ||
      h.toLowerCase().includes("accountname.id")
    );
    const emailIdx = headers.findIndex(h =>
      h.toLowerCase() === "email" ||
      h.toLowerCase() === "email_address"
    );

    if (nameIdx === -1) {
      throw new Error(`Could not find "Contact Name" column. Found: ${headers.join(", ")}`);
    }
    if (accountIdIdx === -1) {
      throw new Error(`Could not find "Account Name.id" column. Found: ${headers.join(", ")}`);
    }

    return rows.map(row => ({
      contactName: row[nameIdx]?.trim() || "",
      accountNameId: row[accountIdIdx]?.trim() || "",
      email: row[emailIdx]?.trim() || "",
    })).filter(c => c.contactName);
  };

  const runLinking = async (dryRun: boolean) => {
    setIsLoading(true);
    try {
      // Parse CSVs
      const zohoAccounts = parseZohoAccounts(zohoAccountsCSV);
      const zohoContacts = parseZohoContacts(zohoContactsCSV);

      console.log(`Parsed ${zohoAccounts.length} Zoho accounts, ${zohoContacts.length} Zoho contacts`);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("You must be logged in to use this tool");
      }

      const { data, error } = await supabase.functions.invoke("link-contacts-accounts", {
        body: { zohoAccounts, zohoContacts, dryRun },
      });

      if (error) throw new Error(error.message || "Edge function call failed");
      if (data?.error) throw new Error(data.error);

      return data as LinkResponse;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!zohoAccountsCSV.trim() || !zohoContactsCSV.trim()) {
      toast({ title: "Missing data", description: "Please paste both Zoho Accounts and Zoho Contacts CSV data", variant: "destructive" });
      return;
    }

    setStep("preview");
    const result = await runLinking(true);
    if (result) {
      setPreviewResult(result);
    } else {
      setStep("input");
    }
  };

  const handleExecute = async () => {
    setStep("executing");
    const result = await runLinking(false);
    if (result) {
      setFinalResult(result);
      setStep("results");
      toast({ title: "Linking Complete", description: `${result.summary.updatedCount} contacts linked to accounts` });
    } else {
      setStep("preview");
    }
  };

  const handleReset = () => {
    setStep("input");
    setPreviewResult(null);
    setFinalResult(null);
  };

  const handleFileUpload = (setter: (v: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setter(text);
    toast({ title: "File loaded", description: `${file.name} loaded (${text.split("\n").length} lines)` });
  };

  const renderSummary = (result: LinkResponse) => {
    const s = result.summary;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Contacts" value={s.totalContacts} />
          <StatCard label="Will Link" value={s.willLink} variant="success" />
          <StatCard label="Already Linked" value={s.alreadyLinked} variant="info" />
          <StatCard label="No Zoho Match" value={s.noZohoMatch} variant="warning" />
          <StatCard label="No CRM Account" value={s.noCrmAccount} variant="warning" />
          <StatCard label="By Email" value={s.matchedByEmail} variant="info" />
          <StatCard label="By Name" value={s.matchedByName} variant="info" />
          <StatCard label="Errors" value={s.errors} variant={s.errors > 0 ? "destructive" : "default"} />
        </div>

        {!s.dryRun && (
          <div className="p-3 rounded-md border bg-muted/50">
            <p className="text-sm font-medium">
              <CheckCircle2 className="inline w-4 h-4 mr-1 text-green-500" />
              {s.updatedCount} contacts updated successfully
              {s.updateErrors > 0 && <span className="text-destructive ml-2">({s.updateErrors} errors)</span>}
            </p>
          </div>
        )}

        <div className="p-3 rounded-md border bg-muted/50 text-sm">
          <p className="font-medium mb-1">Zoho Data Stats:</p>
          <p>Accounts: {s.zohoStats.totalAccounts} | Contacts: {s.zohoStats.totalContacts}</p>
          <p>With account link: {s.zohoStats.contactsWithAccountLink} | Without: {s.zohoStats.contactsWithoutAccountLink}</p>
        </div>

        {result.unmatchedSample.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Unmatched Contacts Sample ({result.unmatchedSample.length}):</p>
            <div className="max-h-60 overflow-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Contact Name</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Zoho Account</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unmatchedSample.map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{c.contactName}</td>
                      <td className="p-2">{c.email || "—"}</td>
                      <td className="p-2">
                        <Badge variant={c.status === "no_zoho_match" ? "secondary" : "outline"} className="text-xs">
                          {c.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-2">{c.zohoAccountName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Link Contacts to Accounts
          </CardTitle>
          <CardDescription>
            Use Zoho CRM mapping data to populate the company_name field for contacts.
            Paste CSV data from Zoho Accounts and Zoho Contacts exports below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "input" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Zoho Accounts CSV</Label>
                  <label className="cursor-pointer">
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload(setZohoAccountsCSV)} />
                    <span className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Upload file
                    </span>
                  </label>
                </div>
                <Textarea
                  placeholder="Paste Zoho Accounts CSV here (columns: zcrm_id, Account Name)..."
                  value={zohoAccountsCSV}
                  onChange={(e) => setZohoAccountsCSV(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                />
                {zohoAccountsCSV && (
                  <p className="text-xs text-muted-foreground">
                    {zohoAccountsCSV.split("\n").length - 1} rows detected
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Zoho Contacts CSV</Label>
                  <label className="cursor-pointer">
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload(setZohoContactsCSV)} />
                    <span className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Upload file
                    </span>
                  </label>
                </div>
                <Textarea
                  placeholder="Paste Zoho Contacts CSV here (columns: Contact Name, Account Name.id, Email)..."
                  value={zohoContactsCSV}
                  onChange={(e) => setZohoContactsCSV(e.target.value)}
                  rows={6}
                  className="font-mono text-xs"
                />
                {zohoContactsCSV && (
                  <p className="text-xs text-muted-foreground">
                    {zohoContactsCSV.split("\n").length - 1} rows detected
                  </p>
                )}
              </div>

              <Button onClick={handlePreview} disabled={isLoading || !zohoAccountsCSV.trim() || !zohoContactsCSV.trim()}>
                <Eye className="w-4 h-4 mr-2" />
                {isLoading ? "Analyzing..." : "Preview Mapping"}
              </Button>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6">
              {isLoading ? (
                <div className="space-y-3 py-8 text-center">
                  <Progress value={50} className="w-64 mx-auto" />
                  <p className="text-sm text-muted-foreground">Analyzing contacts and matching to accounts...</p>
                </div>
              ) : previewResult ? (
                <>
                  <div className="p-3 rounded-md border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Dry Run Preview — No changes have been made yet
                    </p>
                  </div>
                  {renderSummary(previewResult)}
                  <div className="flex gap-3">
                    <Button onClick={handleExecute} disabled={isLoading || previewResult.summary.willLink === 0}>
                      <Play className="w-4 h-4 mr-2" />
                      Execute Linking ({previewResult.summary.willLink} contacts)
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Back to Input
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {step === "executing" && (
            <div className="space-y-3 py-8 text-center">
              <Progress value={70} className="w-64 mx-auto" />
              <p className="text-sm text-muted-foreground">Updating contacts in the database...</p>
            </div>
          )}

          {step === "results" && finalResult && (
            <div className="space-y-6">
              <div className="p-3 rounded-md border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Linking Complete — {finalResult.summary.updatedCount} contacts updated
                </p>
              </div>
              {renderSummary(finalResult)}
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, variant = "default" }: { label: string; value: number; variant?: string }) => {
  const colors: Record<string, string> = {
    default: "bg-muted",
    success: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    warning: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
    info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    destructive: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  };

  return (
    <div className={`p-3 rounded-md border ${colors[variant] || colors.default}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
};

export default DataToolsSettings;
