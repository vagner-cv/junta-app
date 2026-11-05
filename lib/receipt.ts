export const receiptTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type ReceiptSuggestion = {
  title: string | null;
  title_original: string | null;
  merchant: string | null;
  date: string | null;
  total_cents: number | null;
  items: {
    description: string | null;
    friendly_description: string | null;
    quantity: number | null;
    amount_cents: number | null;
  }[];
  warnings: string[];
};
