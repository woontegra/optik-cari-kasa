export const LABEL_TEMPLATES = ['small', 'standard', 'shelf'] as const;
export type LabelTemplate = (typeof LABEL_TEMPLATES)[number];

export interface LabelSettings {
  defaultTemplate: LabelTemplate;
  showPrice: boolean;
  showBarcode: boolean;
  showCompany: boolean;
  previewBeforePrint: boolean;
}

export interface LabelItemInput {
  productId: number;
  quantity: number;
}

export interface LabelPreviewInput {
  items: LabelItemInput[];
  template?: LabelTemplate;
  allowNoBarcode?: boolean;
}

export interface LabelPrintDocument {
  html: string;
  title: string;
}
