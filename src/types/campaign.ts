export interface Campaign {
  id: string;
  campaign_name: string;
  description: string | null;
  campaign_type: string | null;
  status: string;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  region: string | null;
  country: string | null;
  target_audience: string | null;
  message_strategy: string | null;
  created_by: string;
  modified_by: string | null;
  created_at: string;
  modified_at: string;
}

export interface CampaignAccount {
  id: string;
  campaign_id: string;
  account_id: string;
  status: string;
  created_by: string | null;
  created_at: string;
  // joined fields
  accounts?: {
    account_name: string;
    industry: string | null;
    country: string | null;
    account_owner: string | null;
  };
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;
  account_id: string | null;
  stage: string;
  created_by: string | null;
  created_at: string;
  // joined fields
  contacts?: {
    contact_name: string;
    email: string | null;
    phone_no: string | null;
    linkedin: string | null;
    position: string | null;
    company_name: string | null;
  };
}

export interface CampaignCommunication {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  account_id: string | null;
  communication_type: string;
  subject: string | null;
  body: string | null;
  email_type: string | null;
  email_status: string | null;
  linkedin_status: string | null;
  call_outcome: string | null;
  notes: string | null;
  outcome: string | null;
  owner: string | null;
  communication_date: string;
  created_by: string | null;
  created_at: string;
}

export interface CampaignMaterial {
  id: string;
  campaign_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CampaignEmailTemplate {
  id: string;
  campaign_id: string | null;
  template_name: string;
  subject: string | null;
  body: string | null;
  email_type: string | null;
  audience_segment: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CampaignPhoneScript {
  id: string;
  campaign_id: string | null;
  script_name: string | null;
  opening_script: string | null;
  key_talking_points: string | null;
  discovery_questions: string | null;
  objection_handling: string | null;
  audience_segment: string | null;
  created_by: string | null;
  created_at: string;
}

export const CAMPAIGN_STATUSES = ['Draft', 'Active', 'Paused', 'Completed', 'Cancelled'] as const;
export const CAMPAIGN_TYPES = ['Email', 'LinkedIn', 'Phone', 'Multi-Channel'] as const;
export const CAMPAIGN_ACCOUNT_STATUSES = ['Not Contacted', 'Contacted', 'Responded', 'Deal Created'] as const;
export const CAMPAIGN_CONTACT_STAGES = ['Not Contacted', 'Email Sent', 'Phone Contacted', 'LinkedIn Contacted', 'Responded', 'Qualified'] as const;
export const COMMUNICATION_TYPES = ['Email', 'Phone', 'LinkedIn', 'Meeting', 'Follow Up'] as const;
export const EMAIL_TYPES = ['Initial Outreach', 'Follow Up 1', 'Follow Up 2', 'Final Follow Up'] as const;
export const EMAIL_STATUSES = ['Sent', 'Opened', 'Replied'] as const;
export const CALL_OUTCOMES = ['Interested', 'Not Interested', 'Call Later', 'Wrong Contact'] as const;
export const LINKEDIN_STATUSES = ['Not Contacted', 'Connection Sent', 'Connected', 'Message Sent', 'Responded'] as const;
export const MATERIAL_TYPES = ['One Pager', 'Product Overview', 'Case Study', 'Presentation', 'Brochure', 'Technical Document'] as const;
export const AUDIENCE_SEGMENTS = ['CEO / Founder', 'Director / VP', 'Manager', 'Team Leader', 'Technical Staff'] as const;
