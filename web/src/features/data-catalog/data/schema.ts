import { z } from 'zod'

// ─── Data Dictionary (column-level documentation) ────────────────────────────

export const dataDictionarySchema = z.object({
  id: z.number(),
  catalog_id: z.number(),
  column_name: z.string(),
  column_type: z.string().nullable(),
  description: z.string().nullable(),
  is_primary_key: z.boolean(),
  is_nullable: z.boolean(),
  sample_values: z.string().nullable(),
  tags: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type DataDictionary = z.infer<typeof dataDictionarySchema>

export const dataDictionaryFormSchema = z.object({
  column_name: z.string().min(1, 'Column name is required'),
  column_type: z.string().optional(),
  description: z.string().optional(),
  is_primary_key: z.boolean().optional().default(false),
  is_nullable: z.boolean().optional().default(true),
  sample_values: z.string().optional(),
  tags: z.string().optional(),
})

export type DataDictionaryForm = z.infer<typeof dataDictionaryFormSchema>

// ─── Data Catalog (table-level documentation) ────────────────────────────────

export const dataCatalogSchema = z.object({
  id: z.number(),
  source_id: z.number().nullable(),
  destination_id: z.number().nullable(),
  schema_name: z.string(),
  table_name: z.string(),
  description: z.string().nullable(),
  owner: z.string().nullable(),
  tags: z.string().nullable(),
  classification: z.string().nullable(),
  row_count: z.number().nullable(),
  size_bytes: z.number().nullable(),
  last_analyzed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type DataCatalog = z.infer<typeof dataCatalogSchema>

export const dataCatalogFormSchema = z.object({
  source_id: z.number().nullable().optional(),
  destination_id: z.number().nullable().optional(),
  schema_name: z.string().min(1, 'Schema name is required'),
  table_name: z.string().min(1, 'Table name is required'),
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.string().optional(),
  classification: z.string().optional(),
})

export type DataCatalogForm = z.infer<typeof dataCatalogFormSchema>
