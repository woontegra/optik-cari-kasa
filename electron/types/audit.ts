export interface AuditLogRecord {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  module: string;
  description: string;
  entity_type: string | null;
  entity_id: number | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface AuditListFilters {
  date_from?: string;
  date_to?: string;
  user_id?: number;
  module?: string;
  action?: string;
}
