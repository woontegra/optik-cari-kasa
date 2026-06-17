import type { Product } from '@/types/electron';
import type { ParsedBarcode } from '@/types/barcode';

export interface StockEntryLine {
  productId: number;
  barcode: string;
  name: string;
  productType: string;
  brand: string;
  model: string;
  currentStock: number;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  shelfLocation: string;
  updatePrices: boolean;
  serialNo?: string;
  lotNo?: string;
  expiryDate?: string;
}

export interface StockEntryBatchRow {
  id: number;
  batch_no: string;
  supplier_id: number | null;
  supplier_name: string | null;
  document_no: string | null;
  entry_date: string;
  total_items: number;
  total_quantity: number;
  total_cost: number;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export function productToEntryLine(product: Product, quantity = 1, parsed?: ParsedBarcode): StockEntryLine {
  return {
    productId: product.id,
    barcode: parsed?.barcode || product.barcode || '',
    name: product.name,
    productType: product.product_type,
    brand: product.brand || '',
    model: product.model || '',
    currentStock: product.stock_quantity,
    quantity,
    purchasePrice: product.purchase_price,
    salePrice: product.sale_price,
    shelfLocation: product.shelf_location || '',
    updatePrices: false,
    serialNo: parsed?.serialNo,
    lotNo: parsed?.lotNo,
    expiryDate: parsed?.expiryDate,
  };
}
