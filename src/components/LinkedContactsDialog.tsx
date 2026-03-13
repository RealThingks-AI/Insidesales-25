import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface LinkedContact {
  id: string;
  contact_name: string;
  position?: string;
  email?: string;
  phone_no?: string;
}

interface LinkedContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string | null;
}

export const LinkedContactsDialog = ({ open, onOpenChange, accountName }: LinkedContactsDialogProps) => {
  const [contacts, setContacts] = useState<LinkedContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !accountName) {
      setContacts([]);
      return;
    }

    const fetchContacts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("contacts")
        .select("id, contact_name, position, email, phone_no")
        .eq("company_name", accountName)
        .order("contact_name");

      if (!error) setContacts(data || []);
      setLoading(false);
    };

    fetchContacts();
  }, [open, accountName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Contacts linked to "{accountName}"
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No contacts linked to this account.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Contact Name</TableHead>
                <TableHead className="font-semibold">Position</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.contact_name}</TableCell>
                  <TableCell>{c.position || "-"}</TableCell>
                  <TableCell>{c.email || "-"}</TableCell>
                  <TableCell>{c.phone_no || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
