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
  customer_category?: string;
  second_phone?: string;
  whatsapp_phone?: string;
  institution_name?: string;
  institution_no?: string;
  occupation?: string;
  reference_source?: string;
  referred_by_customer_id?: number | null;
  last_visit_date?: string;
  next_control_date?: string;
  whatsapp_permission?: boolean;
  marketing_permission?: boolean;
  important_note?: string;
  risk_note?: string;
  is_vip?: boolean;
  invoice_title?: string;
  tax_office?: string;
  tax_no?: string;
  invoice_address?: string;
  invoice_city?: string;
  invoice_district?: string;
  is_einvoice_registered?: boolean;
  invoice_party_type?: string;
}

export interface CustomerListFilters {
  search?: string;
  status?: string;
  customer_category?: string;
  birthday_this_month?: boolean;
  upcoming_control?: boolean;
  lens_renewal_soon?: boolean;
  has_debt?: boolean;
  inactive_6_months?: boolean;
  marketing_permission?: boolean;
  whatsapp_permission?: boolean;
  sms_permission?: boolean;
  email_permission?: boolean;
}

export interface CustomerQuickInput {
  full_name: string;
  phone?: string;
}
