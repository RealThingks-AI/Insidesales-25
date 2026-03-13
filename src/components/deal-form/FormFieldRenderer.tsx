import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Deal } from "@/types/deal";
import { ContactSearchableDropdown, Contact } from "@/components/ContactSearchableDropdown";
import { AccountSearchableDropdown } from "@/components/AccountSearchableDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";

interface FormFieldRendererProps {
  field: string;
  value: any;
  onChange: (field: string, value: any) => void;
  onContactSelect?: (contact: Contact) => void;
  error?: string;
}

export const FormFieldRenderer = ({ field, value, onChange, onContactSelect, error }: FormFieldRendererProps) => {
  const [leadOwnerIds, setLeadOwnerIds] = useState<string[]>([]);
  const { displayNames, loading } = useUserDisplayNames(leadOwnerIds);

  useEffect(() => {
    if (field === 'lead_owner') {
      fetchLeadOwners();
    }
  }, [field]);

  const fetchLeadOwners = async () => {
    try {
      // Fetch all unique deal owners (created_by) from deals table at Lead stage
      const { data: deals, error } = await supabase
        .from('deals')
        .select('created_by')
        .eq('stage', 'Lead')
        .not('created_by', 'is', null);

      if (error) {
        console.error('Error fetching lead owners:', error);
        return;
      }

      // Get unique user IDs
      const uniqueUserIds = Array.from(new Set(deals.map(deal => deal.created_by).filter(Boolean)));
      setLeadOwnerIds(uniqueUserIds);
    } catch (error) {
      console.error('Error in fetchLeadOwners:', error);
    }
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      project_name: 'Project Name',
      customer_name: 'Account',
      lead_name: 'Contact Name',
      lead_owner: 'Lead Owner',
      region: 'Region',
      priority: 'Priority',
      probability: 'Probability (%)',
      internal_comment: 'Internal Comment',
      expected_closing_date: 'Expected Closing Date',
      customer_need: 'Customer Need',
      customer_challenges: 'Customer Challenges',
      relationship_strength: 'Relationship Strength',
      budget: 'Budget',
      is_recurring: 'Is Recurring?',
      project_type: 'Project Type',
      duration: 'Duration (months)',
      revenue: 'Revenue',
      start_date: 'Start Date',
      end_date: 'End Date',
      total_contract_value: 'Total Contract Value',
      currency_type: 'Currency Type',
      project_duration: 'Project Duration (months)',
      rfq_received_date: 'RFQ Received Date',
      proposal_due_date: 'Proposal Due Date',
      rfq_status: 'RFQ Status',
      quarterly_revenue_q1: 'Q1 Revenue',
      quarterly_revenue_q2: 'Q2 Revenue',
      quarterly_revenue_q3: 'Q3 Revenue',
      quarterly_revenue_q4: 'Q4 Revenue',
      total_revenue: 'Total Revenue',
      action_items: 'Action Items',
      current_status: 'Current Status',
      closing: 'Closing',
      won_reason: 'Won Reason',
      lost_reason: 'Lost Reason',
      need_improvement: 'Need Improvement',
      drop_reason: 'Drop Reason',
      fax: 'Fax',
      business_value: 'Business Value',
      decision_maker_level: 'Decision Maker Level',
      signed_contract_date: 'Signed Contract Date',
      implementation_start_date: 'Implementation Start Date',
      handoff_status: 'Handoff Status',
    };
    return labels[field] || field;
  };

  const getStringValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val);
  };

  const handleNumericChange = (fieldName: string, inputValue: string) => {
    console.log(`=== NUMERIC FIELD CHANGE DEBUG ===`);
    console.log(`Field: ${fieldName}, Input value: "${inputValue}"`);
    
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      console.log(`Setting ${fieldName} to 0 (empty input)`);
      onChange(fieldName, 0);
      return;
    }
    
    const numericValue = parseFloat(inputValue);
    if (isNaN(numericValue)) {
      console.log(`Invalid numeric value for ${fieldName}: "${inputValue}"`);
      onChange(fieldName, 0);
      return;
    }
    
    // For revenue fields, ensure positive values
    if (fieldName.includes('revenue') && numericValue < 0) {
      console.log(`Setting ${fieldName} to 0 (negative value not allowed)`);
      onChange(fieldName, 0);
      return;
    }
    
    console.log(`Setting ${fieldName} to ${numericValue}`);
    onChange(fieldName, numericValue);
  };

  const handleContactSelect = async (contact: Contact) => {
    console.log("Selected contact:", contact);
    
    // Auto-fill available fields based on contact data
    onChange('lead_name', contact.contact_name);
    if (contact.company_name) onChange('customer_name', contact.company_name);
    if (contact.region) onChange('region', contact.region);

    // Handle lead owner - fetch display name for the contact's owner
    const ownerUserId = contact.contact_owner;
    if (ownerUserId) {
      console.log("Fetching display name for contact owner:", ownerUserId);
      
      try {
        const { data: functionResult, error: functionError } = await supabase.functions.invoke(
          'fetch-user-display-names',
          { body: { userIds: [ownerUserId] } }
        );

        if (!functionError && functionResult?.userDisplayNames) {
          const ownerName = functionResult.userDisplayNames[ownerUserId];
          if (ownerName) {
            onChange('lead_owner', ownerName);
          } else {
            onChange('lead_owner', 'Unknown User');
          }
        } else {
          // Fallback to direct query
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, "Email ID"')
            .eq('id', ownerUserId)
            .single();

          if (profilesData) {
            let displayName = "Unknown User";
            if (profilesData.full_name?.trim() && 
                !profilesData.full_name.includes('@') &&
                profilesData.full_name !== profilesData["Email ID"]) {
              displayName = profilesData.full_name.trim();
            } else if (profilesData["Email ID"]) {
              displayName = profilesData["Email ID"].split('@')[0];
            }
            onChange('lead_owner', displayName);
          } else {
            onChange('lead_owner', 'Unknown User');
          }
        }
      } catch (error) {
        console.error("Error fetching contact owner display name:", error);
        onChange('lead_owner', 'Unknown User');
      }
    }

    onContactSelect?.(contact);
  };

  const handleAccountSelect = (account: { region?: string; industry?: string }) => {
    // Auto-fill region from account only if currently empty
    if (account.region && !value) {
      // We can't check the form's region value from here, so we always set it
      // The parent form should handle dedup logic if needed
    }
  };

  const renderDatePicker = (fieldName: string, dateValue: any) => {
    const date = dateValue ? new Date(dateValue) : undefined;
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                const formattedDate = format(selectedDate, "yyyy-MM-dd");
                console.log(`Date field ${fieldName} update: setting to ${formattedDate}`);
                onChange(fieldName, formattedDate);
              } else {
                onChange(fieldName, '');
              }
            }}
            disabled={(date) => date > new Date()} // Disable future dates
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
  };

  const renderField = () => {
    switch (field) {
      case 'lead_name':
        return (
          <ContactSearchableDropdown
            value={getStringValue(value)}
            onValueChange={(val) => onChange(field, val)}
            onContactSelect={handleContactSelect}
            placeholder="Search and select a contact..."
          />
        );

      case 'customer_name':
        return (
          <AccountSearchableDropdown
            value={getStringValue(value)}
            onValueChange={(val) => onChange(field, val)}
            placeholder="Search and select an account..."
          />
        );

      case 'lead_owner':
        return (
          <Input
            value={getStringValue(value)}
            onChange={(e) => onChange(field, e.target.value)}
            placeholder="Enter lead owner name..."
          />
        );

      case 'priority':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => onChange(field, parseInt(val))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map(num => (
                <SelectItem key={num} value={num.toString()}>
                  Priority {num} {num === 1 ? '(Highest)' : num === 2 ? '(High)' : num === 3 ? '(Medium)' : num === 4 ? '(Low)' : '(Lowest)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'probability':
        return (
          <Select
            value={value ? value.toString() : ''}
            onValueChange={(val) => {
              console.log(`Probability update: setting to ${val}`);
              onChange(field, parseInt(val));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select probability" />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(percent => (
                <SelectItem key={percent} value={percent.toString()}>
                  {percent}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'region':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => onChange(field, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {['EU', 'US', 'ASIA', 'Other'].map(region => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'customer_need':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => onChange(field, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select customer need" />
            </SelectTrigger>
            <SelectContent>
              {['Open', 'Ongoing', 'Done'].map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'customer_challenges':
      case 'business_value':
      case 'decision_maker_level':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => {
              console.log(`${field} update: setting to ${val}`);
              onChange(field, val);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${getFieldLabel(field).toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {['Open', 'Ongoing', 'Done'].map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'relationship_strength':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => onChange(field, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select relationship strength" />
            </SelectTrigger>
            <SelectContent>
              {['Low', 'Medium', 'High'].map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'budget':
        return (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={getStringValue(value)}
            onChange={(e) => {
              console.log(`Budget update: setting to ${e.target.value}`);
              handleNumericChange(field, e.target.value);
            }}
            placeholder="Enter budget in euros..."
          />
        );

      case 'is_recurring':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => {
              console.log(`Is recurring update: setting to ${val}`);
              onChange(field, val);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select recurring status" />
            </SelectTrigger>
            <SelectContent>
              {['Yes', 'No', 'Unclear'].map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'currency_type':
        return (
          <Select
            value={value?.toString() || 'EUR'}
            onValueChange={(val) => onChange(field, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: 'EUR', label: '€ EUR' },
                { value: 'USD', label: '$ USD' },
                { value: 'INR', label: '₹ INR' },
              ].map(currency => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'rfq_status':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => onChange(field, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select RFQ status" />
            </SelectTrigger>
            <SelectContent>
              {['Drafted', 'Submitted', 'Rejected', 'Accepted'].map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'handoff_status':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(val) => {
              console.log(`Handoff status update: setting to ${val}`);
              onChange(field, val);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select handoff status" />
            </SelectTrigger>
            <SelectContent>
              {['Not Started', 'In Progress', 'Complete'].map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'signed_contract_date':
      case 'implementation_start_date':
        return renderDatePicker(field, value);

      case 'expected_closing_date':
      case 'start_date':
      case 'end_date':
      case 'rfq_received_date':
      case 'proposal_due_date':
        return (
          <Input
            type="date"
            value={getStringValue(value)}
            onChange={(e) => {
              console.log(`Date field ${field} update: setting to ${e.target.value}`);
              onChange(field, e.target.value);
            }}
          />
        );

      case 'total_contract_value':
      case 'project_duration':
        return (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={getStringValue(value)}
            onChange={(e) => {
              console.log(`RFQ numeric field ${field} update: setting to ${e.target.value}`);
              handleNumericChange(field, e.target.value);
            }}
            placeholder={field === 'project_duration' ? 'Enter duration in months...' : 'Enter value...'}
          />
        );

      case 'quarterly_revenue_q1':
      case 'quarterly_revenue_q2':
      case 'quarterly_revenue_q3':
      case 'quarterly_revenue_q4':
        return (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={getStringValue(value)}
            onChange={(e) => {
              console.log(`Revenue field ${field} update: setting to ${e.target.value}`);
              handleNumericChange(field, e.target.value);
            }}
            placeholder="Enter quarterly revenue..."
          />
        );

      case 'total_revenue':
        return (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={getStringValue(value)}
            onChange={(e) => {
              console.log(`Total revenue field ${field} update: setting to ${e.target.value}`);
              handleNumericChange(field, e.target.value);
            }}
            placeholder="Enter total revenue..."
          />
        );

      case 'duration':
      case 'revenue':
        return (
          <Input
            type="number"
            value={getStringValue(value)}
            onChange={(e) => handleNumericChange(field, e.target.value)}
          />
        );

      case 'internal_comment':
      case 'action_items':
      case 'closing':
      case 'won_reason':
      case 'lost_reason':
      case 'need_improvement':
      case 'drop_reason':
        return (
          <Textarea
            value={getStringValue(value)}
            onChange={(e) => {
              console.log(`Textarea field ${field} update: setting to ${e.target.value}`);
              onChange(field, e.target.value);
            }}
            rows={3}
            placeholder={`Enter ${getFieldLabel(field).toLowerCase()}...`}
          />
        );

      case 'fax':
        return (
          <Input
            type="tel"
            value={getStringValue(value)}
            onChange={(e) => onChange(field, e.target.value)}
            placeholder={`Enter ${getFieldLabel(field).toLowerCase()}...`}
          />
        );

      default:
        return (
          <Input
            value={getStringValue(value)}
            onChange={(e) => onChange(field, e.target.value)}
            placeholder={`Enter ${getFieldLabel(field).toLowerCase()}...`}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <Label>{getFieldLabel(field)}</Label>
      {renderField()}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
