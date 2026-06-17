export interface CustomerInput {
  full_name: string;
  tc_no?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  address?: string;
  city?: string;
  district?: string;
  notes?: string;
  kvkk_consent?: boolean;
  sms_permission?: boolean;
  email_permission?: boolean;
  is_active?: boolean;
}

export interface CustomerListFilters {
  search?: string;
  status?: string;
}

export interface CustomerQuickInput {
  full_name: string;
  phone?: string;
}
