export interface StockEntryLineInput {
  product_id: number;
  barcode?: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
  shelf_location?: string;
  update_prices?: boolean;
}

export interface CompleteStockEntryInput {
  supplier_id?: number | null;
  document_no?: string;
  entry_date: string;
  notes?: string;
  items: StockEntryLineInput[];
}

export interface StockEntryBatchListFilters {
  date_from?: string;
  date_to?: string;
  supplier_id?: number;
  search?: string;
}
