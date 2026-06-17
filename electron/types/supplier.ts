export interface SupplierInput {
  name: string;
  authorized_person?: string;
  phone?: string;
  email?: string;
  tax_office?: string;
  tax_no?: string;
  city?: string;
  district?: string;
  address?: string;
  notes?: string;
}

export interface SupplierRow {
  id: number;
  name: string;
  authorized_person: string | null;
  phone: string | null;
  email: string | null;
  tax_office: string | null;
  tax_no: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  notes: string | null;
  balance: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}
