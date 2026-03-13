import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  account_name: string;
  region?: string;
  industry?: string;
}

interface AccountSearchableDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  onAccountSelect?: (account: Account) => void;
  placeholder?: string;
  className?: string;
}

export const AccountSearchableDropdown = ({
  value,
  onValueChange,
  onAccountSelect,
  placeholder = "Select account...",
  className,
}: AccountSearchableDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("accounts")
          .select("id, account_name, region, industry")
          .order("account_name", { ascending: true });

        if (error) throw error;
        setAccounts(data || []);
      } catch (error) {
        console.error("Error fetching accounts:", error);
        toast({ title: "Error", description: "Failed to fetch accounts", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [toast]);

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[-_.,()]/g, ' ').replace(/\s+/g, ' ').trim();

  const filteredAccounts = useMemo(() => {
    if (!searchValue) return accounts;
    const searchWords = normalize(searchValue).split(' ').filter(Boolean);
    return accounts.filter((a) => {
      const combined = normalize(
        `${a.account_name || ''} ${a.region || ''} ${a.industry || ''}`
      );
      return searchWords.every((word) => combined.includes(word));
    });
  }, [accounts, searchValue]);

  const handleSelect = (account: Account) => {
    onValueChange(account.account_name);
    onAccountSelect?.(account);
    setOpen(false);
    setSearchValue("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && (
              <X className="h-3 w-3 opacity-50 hover:opacity-100" onClick={handleClear} />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" side="bottom" avoidCollisions={false} style={{ pointerEvents: 'auto' }}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search accounts..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList
            onWheel={(e) => {
              e.stopPropagation();
              const target = e.currentTarget;
              target.scrollTop += e.deltaY;
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading accounts...</span>
              </div>
            ) : (
              <>
                {filteredAccounts.length === 0 && !loading && (
                  <div className="py-6 text-center text-sm text-muted-foreground">No accounts found.</div>
                )}
                <CommandGroup>
                  {filteredAccounts.map((account) => (
                    <CommandItem
                      key={account.id}
                      value={account.account_name}
                      onSelect={() => handleSelect(account)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === account.account_name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{account.account_name}</div>
                        {(account.region || account.industry) && (
                          <div className="text-xs text-muted-foreground truncate">
                            {[account.region, account.industry].filter(Boolean).join(" • ")}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
