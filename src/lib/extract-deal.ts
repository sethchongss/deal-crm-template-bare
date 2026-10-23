import { z } from "zod";

export const extractedDealSchema = z.object({
  deal_name: z.string().nullable(),
  company: z.string().nullable(),
  sector: z.string().nullable(),
  country: z.string().nullable(),
  description: z.string().nullable(),
  source: z.string().nullable(),
  currency: z.string().nullable(),
  financial_year: z.string().nullable(),
  revenue: z.string().nullable(),
  ebitda: z.string().nullable(),
  net_debt: z.string().nullable(),
  enterprise_value: z.string().nullable(),
  ownership: z.string().nullable(),
  transaction_type: z.string().nullable(),
  stake_percent: z.number().nullable(),
  ticket_size: z.string().nullable(),
  other_financials: z.string().nullable(),
});

export type ExtractedDeal = z.infer<typeof extractedDealSchema>;

export const EXTRACT_INSTRUCTIONS = `You extract fields for a private-equity deal tracker from a teaser, information memorandum, or CIM.
Return null for anything the document does not support. Do not invent numbers.
Amounts should keep their currency and scale, for example "S$187.7M" or "US$12.4M".
stake_percent is a number from 0 to 100, or null.
currency is a 3-letter code when one currency is clear, else null.`;
