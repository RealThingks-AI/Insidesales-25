import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AccountDetail {
  id: string;
  account_name: string;
  phone?: string;
  website?: string;
  industry?: string;
  company_type?: string;
  country?: string;
  region?: string;
  status?: string;
  description?: string;
  account_owner?: string;
  currency?: string;
  created_time?: string;
  modified_time?: string;
}

interface AccountViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string | null;
}

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case "New": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "Working": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "Qualified": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    default: return "bg-muted text-muted-foreground";
  }
};

export const AccountViewModal = ({ open, onOpenChange, accountName }: AccountViewModalProps) => {
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const ownerIds = account?.account_owner ? [account.account_owner] : [];
  const { displayNames } = useUserDisplayNames(ownerIds);

  useEffect(() => {
    if (!open || !accountName) {
      setAccount(null);
      return;
    }

    const fetchAccount = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("account_name", accountName)
        .limit(1)
        .maybeSingle();

      if (!error && data) setAccount(data);
      setLoading(false);
    };

    fetchAccount();
  }, [open, accountName]);

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{children || "-"}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !account ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Account not found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Field label="Account Name">{account.account_name}</Field>
            <Field label="Status">
              {account.status ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(account.status)}`}>
                  {account.status}
                </span>
              ) : "-"}
            </Field>
            <Field label="Phone">{account.phone}</Field>
            <Field label="Website">
              {account.website ? (
                <a
                  href={account.website.startsWith("http") ? account.website : `https://${account.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {account.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : "-"}
            </Field>
            <Field label="Industry">{account.industry}</Field>
            <Field label="Company Type">{account.company_type}</Field>
            <Field label="Country">{account.country}</Field>
            <Field label="Region">{account.region}</Field>
            <Field label="Currency">{account.currency}</Field>
            <Field label="Account Owner">
              {account.account_owner ? displayNames[account.account_owner] || "Loading..." : "-"}
            </Field>
            <div className="col-span-2">
              <Field label="Description">{account.description}</Field>
            </div>
            <Field label="Created">
              {account.created_time ? format(new Date(account.created_time), "dd MMM yyyy") : "-"}
            </Field>
            <Field label="Last Modified">
              {account.modified_time ? format(new Date(account.modified_time), "dd MMM yyyy") : "-"}
            </Field>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
