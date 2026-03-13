export type DealStage = 'Lead' | 'Discussions' | 'Qualified' | 'RFQ' | 'Offered' | 'Won' | 'Lost' | 'Dropped';

export interface Deal {
  id: string;
  created_at: string;
  modified_at: string;
  created_by: string | null;
  modified_by: string | null;
  
  // Basic deal info
  deal_name: string;
  stage: DealStage;
  
  // Lead stage fields
  project_name?: string;
  customer_name?: string;
  lead_name?: string;
  lead_owner?: string;
  region?: string;
  priority?: number; // 1-5 range enforced by DB constraint
  probability?: number; // 0-100 range enforced by DB constraint
  internal_comment?: string;
  
  // Discussions stage fields
  expected_closing_date?: string;
  customer_need?: string;
  customer_challenges?: 'Open' | 'Ongoing' | 'Done';
  relationship_strength?: 'Low' | 'Medium' | 'High';
  
  // Qualified stage fields
  budget?: string;
  business_value?: 'Open' | 'Ongoing' | 'Done';
  decision_maker_level?: 'Open' | 'Ongoing' | 'Done';
  is_recurring?: 'Yes' | 'No' | 'Unclear';
  
  // RFQ stage fields
  total_contract_value?: number;
  currency_type?: 'EUR' | 'USD' | 'INR';
  start_date?: string;
  end_date?: string;
  project_duration?: number;
  action_items?: string;
  rfq_received_date?: string;
  proposal_due_date?: string;
  rfq_status?: 'Drafted' | 'Submitted' | 'Rejected' | 'Accepted';
  
  // Offered stage fields
  current_status?: string;
  closing?: string;
  
  // Won stage fields
  won_reason?: string;
  quarterly_revenue_q1?: number;
  quarterly_revenue_q2?: number;
  quarterly_revenue_q3?: number;
  quarterly_revenue_q4?: number;
  total_revenue?: number;
  signed_contract_date?: string;
  implementation_start_date?: string;
  handoff_status?: 'Not Started' | 'In Progress' | 'Complete';
  
  // Lost stage fields
  lost_reason?: string;
  need_improvement?: string;
  
  // Dropped stage fields
  drop_reason?: string;

  // Stakeholder contacts
  budget_owner_contact_id?: string;
  champion_contact_id?: string;
  objector_contact_id?: string;
  influencer_contact_id?: string;
}

export const DEAL_STAGES: DealStage[] = ['Lead', 'Discussions', 'Qualified', 'RFQ', 'Offered', 'Won', 'Lost', 'Dropped'];

export const STAGE_COLORS = {
  Lead: 'text-stage-lead-foreground',
  Discussions: 'text-stage-discussions-foreground',
  Qualified: 'text-stage-qualified-foreground',
  RFQ: 'text-stage-rfq-foreground',
  Offered: 'text-stage-offered-foreground',
  Won: 'text-stage-won-foreground',
  Lost: 'text-stage-lost-foreground',
  Dropped: 'text-stage-dropped-foreground',
};

export const STAGE_BG_COLORS: Record<DealStage, string> = {
  Lead: 'bg-stage-lead border-stage-lead-foreground/30',
  Discussions: 'bg-stage-discussions border-stage-discussions-foreground/30',
  Qualified: 'bg-stage-qualified border-stage-qualified-foreground/30',
  RFQ: 'bg-stage-rfq border-stage-rfq-foreground/30',
  Offered: 'bg-stage-offered border-stage-offered-foreground/30',
  Won: 'bg-stage-won border-stage-won-foreground/30',
  Lost: 'bg-stage-lost border-stage-lost-foreground/30',
  Dropped: 'bg-stage-dropped border-stage-dropped-foreground/30',
};

export const getStageIndex = (stage: DealStage): number => {
  return DEAL_STAGES.indexOf(stage);
};

export const getFieldsForStage = (stage: DealStage): string[] => {
  const stageIndex = getStageIndex(stage);
  const allStages = [
    // Lead fields
    ['project_name', 'lead_name', 'customer_name', 'region', 'lead_owner', 'priority'],
    // Discussions fields  
    ['customer_need', 'relationship_strength', 'internal_comment'],
    // Qualified fields
    ['budget', 'business_value', 'decision_maker_level', 'customer_challenges', 'probability', 'expected_closing_date', 'is_recurring'],
    // RFQ fields
    ['total_contract_value', 'currency_type', 'start_date', 'end_date', 'project_duration', 'rfq_received_date', 'proposal_due_date', 'rfq_status', 'action_items'],
    // Offered fields
    ['business_value', 'decision_maker_level', 'current_status', 'closing'],
  ];
  
  let availableFields: string[] = [];
  for (let i = 0; i <= stageIndex && i < allStages.length; i++) {
    availableFields = [...availableFields, ...allStages[i]];
  }
  
  // Add final stage-specific reason fields based on the current stage
  if (stage === 'Won') {
    availableFields.push('won_reason', 'quarterly_revenue_q1', 'quarterly_revenue_q2', 'quarterly_revenue_q3', 'quarterly_revenue_q4', 'total_revenue', 'signed_contract_date', 'implementation_start_date', 'handoff_status');
  } else if (stage === 'Lost') {
    availableFields.push('lost_reason', 'need_improvement');
  } else if (stage === 'Dropped') {
    availableFields.push('drop_reason');
  }
  
  // Always include internal_comment field
  if (!availableFields.includes('internal_comment')) {
    availableFields.push('internal_comment');
  }
  
  return availableFields;
};

export const getEditableFieldsForStage = (stage: DealStage): string[] => {
  // All fields are always editable according to requirements
  return getFieldsForStage(stage);
};

export const getRequiredFieldsForStage = (stage: DealStage): string[] => {
  const requiredFields = {
    Lead: ['project_name', 'lead_name', 'customer_name', 'region', 'lead_owner', 'priority'],
    Discussions: ['customer_need', 'relationship_strength', 'internal_comment'],
    Qualified: ['customer_challenges', 'budget', 'probability', 'expected_closing_date', 'is_recurring', 'internal_comment'],
    RFQ: ['total_contract_value', 'currency_type', 'start_date', 'end_date', 'rfq_received_date', 'proposal_due_date', 'rfq_status', 'action_items', 'internal_comment'],
    Offered: ['business_value', 'decision_maker_level', 'current_status', 'closing'],
    Won: ['won_reason', 'start_date', 'total_revenue', 'signed_contract_date', 'handoff_status'],
    Lost: ['lost_reason', 'need_improvement'],
    Dropped: ['drop_reason'],
  };
  return requiredFields[stage] || [];
};

export const getNextStage = (currentStage: DealStage): DealStage | null => {
  const stageFlow = {
    Lead: 'Discussions',
    Discussions: 'Qualified', 
    Qualified: 'RFQ',
    RFQ: 'Offered',
    Offered: null, // After Offered, user can choose Won/Lost/Dropped
  };
  return stageFlow[currentStage] || null;
};

export const getFinalStageOptions = (): DealStage[] => {
  return ['Won', 'Lost', 'Dropped'];
};
