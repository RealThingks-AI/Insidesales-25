// Simplified interface for column configuration
interface ColumnConfig {
  allowedColumns: string[];
  required: string[];
  enums: Record<string, string[]>;
}

// Define column mappings for different modules
export const getColumnConfig = (table: string): ColumnConfig => {
  const configs: Record<string, ColumnConfig> = {
    // Contacts - Removed website, industry, region, country, segment as per requirements
    contacts_module: {
      allowedColumns: [
        'id', 'contact_name', 'company_name', 'position', 'email', 
        'phone_no', 'linkedin', 'contact_source', 'tags', 
        'description', 'last_contacted_at', 'account_id',
        'contact_owner', 'created_by', 'modified_by', 'created_time', 'modified_time'
      ],
      required: ['contact_name'],
      enums: {
        contact_source: ['Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Trade Show', 'LinkedIn', 'Conference', 'Other']
      }
    },
    contacts: {
      allowedColumns: [
        'id', 'contact_name', 'company_name', 'position', 'email', 
        'phone_no', 'linkedin', 'contact_source', 'tags', 
        'description', 'last_contacted_at', 'account_id',
        'contact_owner', 'created_by', 'modified_by', 'created_time', 'modified_time'
      ],
      required: ['contact_name'],
      enums: {
        contact_source: ['Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Trade Show', 'LinkedIn', 'Conference', 'Other']
      }
    },
    // Leads - Removed region, mobile_no, no_of_employees, annual_revenue (don't exist in DB), added account_id
    leads: {
      allowedColumns: [
        'id', 'lead_name', 'company_name', 'position', 'email', 
        'phone_no', 'linkedin', 'website', 'contact_source',
        'lead_status', 'industry', 'country', 'description', 'account_id',
        'contact_owner', 'created_by', 'modified_by', 'created_time', 'modified_time'
      ],
      required: ['lead_name'],
      enums: {
        contact_source: ['Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Trade Show', 'LinkedIn', 'Conference', 'Other'],
        lead_status: ['New', 'Contacted', 'Qualified', 'Nurture', 'Converted', 'Lost'],
        industry: ['Automotive', 'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Energy', 'Telecom', 'Other']
      }
    },
    meetings: {
      allowedColumns: [
        'id', 'subject', 'description', 'start_time', 'end_time',
        'status', 'outcome', 'notes', 'join_url',
        'lead_id', 'contact_id', 'deal_id', 'account_id',
        'created_by', 'created_at', 'updated_at'
      ],
      required: ['subject', 'start_time', 'end_time'],
      enums: {
        status: ['scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled'],
        outcome: ['Successful', 'Follow-up Required', 'No Show', 'Rescheduled', 'Not Applicable']
      }
    },
    tasks: {
      allowedColumns: [
        'id', 'title', 'description', 'status', 'priority',
        'due_date', 'due_time', 'module_type', 'category',
        'account_id', 'contact_id', 'lead_id', 'deal_id', 'meeting_id',
        'assigned_to', 'created_by', 'created_at', 'completed_at', 'updated_at'
      ],
      required: ['title'],
      enums: {
        status: ['open', 'in_progress', 'completed', 'cancelled'],
        priority: ['low', 'medium', 'high'],
        module_type: ['account', 'contact', 'lead', 'deal', 'meeting', 'general']
      }
    },
    // Accounts - Added last_activity_date, contact_count, deal_count for linked data
    accounts: {
      allowedColumns: [
        'id', 'company_name', 'email', 'phone', 'company_type', 'industry',
        'website', 'country', 'region', 'status', 'tags', 'notes',
        'last_activity_date', 'contact_count', 'deal_count',
        'account_owner', 'created_by', 'modified_by', 'created_at', 'updated_at'
      ],
      required: ['company_name'],
      enums: {
        status: ['New', 'Working', 'Warm', 'Hot', 'Nurture', 'Closed-Won', 'Closed-Lost'],
        company_type: ['Customer', 'Partner', 'Prospect', 'Vendor', 'Other']
      }
    },
    // Deals - Added account_id, contact_id
    deals: {
      allowedColumns: [
        'id', 'deal_name', 'stage', 'internal_comment', 'project_name',
        'lead_name', 'customer_name', 'region', 'lead_owner', 'priority',
        'customer_need', 'relationship_strength', 'budget', 'probability',
        'expected_closing_date', 'is_recurring', 'customer_challenges',
        'business_value', 'decision_maker_level', 'total_contract_value',
        'currency_type', 'start_date', 'end_date', 'project_duration',
        'action_items', 'rfq_received_date', 'proposal_due_date', 'rfq_status',
        'current_status', 'closing', 'won_reason', 'quarterly_revenue_q1',
        'quarterly_revenue_q2', 'quarterly_revenue_q3', 'quarterly_revenue_q4',
        'total_revenue', 'signed_contract_date', 'implementation_start_date',
        'handoff_status', 'lost_reason', 'need_improvement', 'drop_reason',
        'account_id', 'contact_id',
        'created_by', 'modified_by', 'created_at', 'modified_at'
      ],
      required: ['deal_name', 'stage'],
      enums: {
        stage: ['Lead', 'Discussions', 'Qualified', 'RFQ', 'Offered', 'Won', 'Lost', 'Dropped'],
        currency_type: ['EUR', 'USD', 'INR'],
        customer_challenges: ['Open', 'Ongoing', 'Done'],
        relationship_strength: ['Low', 'Medium', 'High'],
        business_value: ['Open', 'Ongoing', 'Done'],
        decision_maker_level: ['Open', 'Ongoing', 'Done'],
        is_recurring: ['Yes', 'No', 'Unclear'],
        rfq_status: ['Drafted', 'Submitted', 'Rejected', 'Accepted'],
        handoff_status: ['Not Started', 'In Progress', 'Complete']
      }
    }
  };
  return configs[table] || configs.contacts_module;
};
