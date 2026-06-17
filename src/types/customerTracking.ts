export const APPOINTMENT_TYPES = [
  'Muayene',
  'Gözlük Teslim',
  'Lens Kontrol',
  'Reçete Takip',
  'Servis / Arıza',
  'Diğer',
] as const;

export const APPOINTMENT_STATUSES = ['Planlandı', 'Geldi', 'Gelmedi', 'İptal', 'Ertelendi'] as const;
export const REPEAT_TYPES = ['Tek seferlik', 'Yıllık', 'Aylık', 'Yok'] as const;
export const COMMUNICATION_CHANNELS = ['SMS', 'EMAIL', 'WHATSAPP'] as const;
export const COMMUNICATION_STATUSES = ['Hazırlandı', 'Gönderildi İşaretlendi', 'İptal', 'Hatalı'] as const;
export const CUSTOMER_DOCUMENT_TYPES = [
  'Müşteri bilgi formu',
  'Satış geçmişi dökümü',
  'Reçete özeti',
  'Cari hesap dökümü',
  'Teslim belgesi',
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type RepeatType = (typeof REPEAT_TYPES)[number];
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];
export type CustomerDocumentType = (typeof CUSTOMER_DOCUMENT_TYPES)[number];

export interface Appointment {
  id: number;
  customer_id: number;
  appointment_date: string;
  appointment_time?: string;
  appointment_type: string;
  status: string;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  whatsapp_phone?: string;
}

export interface ImportantDate {
  id: number;
  customer_id: number;
  title: string;
  date: string;
  repeat_type: string;
  reminder_days_before: number;
  notes?: string;
  is_active: number;
}

export interface CommunicationTemplate {
  id: number;
  channel: string;
  name: string;
  subject?: string;
  body: string;
  is_active: number;
}

export interface CommunicationLog {
  id: number;
  customer_id: number;
  channel: string;
  template_id?: number;
  template_name?: string;
  subject?: string;
  message: string;
  status: string;
  sent_at?: string;
  created_at: string;
  notes?: string;
}

export interface PreparedMessage {
  channel: string;
  subject: string;
  body: string;
  phone: string;
  email: string;
  whatsappUrl: string;
  mailtoUrl: string;
}

export interface CustomerCategory {
  id: number;
  name: string;
  code?: string;
}

export interface AppointmentListFilters {
  view?: 'today' | 'week' | 'overdue' | 'all';
  customer_id?: number;
  status?: string;
}

export interface CustomerReminderListFilters {
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
  search?: string;
}
