import { api } from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DataDictionary {
  id: number
  catalog_id: number
  column_name: string
  data_type: string
  column_type?: string | null
  description: string | null
  is_nullable: boolean
  is_primary_key: boolean
  is_pii: boolean
  sample_values: string | null
  business_rule: string | null
  tags?: string | null
  created_at: string
  updated_at: string
}

export interface DataCatalog {
  id: number
  source_id: number | null
  destination_id: number | null
  table_name: string
  schema_name: string
  description: string | null
  owner: string | null
  tags: string | null
  classification: string | null
  sla_freshness_minutes: number | null
  row_count: number | null
  size_bytes: number | null
  last_analyzed_at: string | null
  created_at: string
  updated_at: string
  columns: DataDictionary[]
}

export interface DataCatalogCreate {
  source_id?: number | null
  destination_id?: number | null
  table_name: string
  schema_name?: string
  description?: string
  owner?: string
  tags?: string
  classification?: string
  row_count?: number
  size_bytes?: number
}

export interface DataCatalogUpdate {
  schema_name?: string
  table_name?: string
  description?: string
  owner?: string
  tags?: string
  classification?: string
  source_id?: number | null
  destination_id?: number | null
  row_count?: number
  size_bytes?: number
}

export interface DataCatalogListResponse {
  items: DataCatalog[]
  total: number
  page: number
  page_size: number
}

export interface DataDictionaryCreate {
  column_name: string
  data_type?: string
  description?: string
  is_nullable?: boolean
  is_primary_key?: boolean
  is_pii?: boolean
  sample_values?: string
  business_rule?: string
}

export interface DataDictionaryUpdate {
  column_name?: string
  data_type?: string
  description?: string
  is_nullable?: boolean
  is_primary_key?: boolean
  is_pii?: boolean
  sample_values?: string
  business_rule?: string
}

// ─── Repository ──────────────────────────────────────────────────────────────

export const dataCatalogRepo = {
  list(page = 1, pageSize = 20, search?: string) {
    return api.get<DataCatalogListResponse>('/data-catalog', {
      params: { page, page_size: pageSize, search },
    })
  },

  get(id: number) {
    return api.get<DataCatalog>(`/data-catalog/${id}`)
  },

  create(payload: DataCatalogCreate) {
    return api.post<DataCatalog>('/data-catalog', payload)
  },

  update(id: number, payload: DataCatalogUpdate) {
    return api.put<DataCatalog>(`/data-catalog/${id}`, payload)
  },

  remove(id: number) {
    return api.delete<{ message: string }>(`/data-catalog/${id}`)
  },

  // Dictionary columns
  getColumns(catalogId: number) {
    return api.get<DataDictionary[]>(`/data-catalog/${catalogId}/columns`)
  },

  addColumn(catalogId: number, payload: DataDictionaryCreate) {
    return api.post<DataDictionary>(`/data-catalog/${catalogId}/columns`, payload)
  },

  updateColumn(columnId: number, payload: DataDictionaryUpdate) {
    return api.put<DataDictionary>(`/data-catalog/columns/${columnId}`, payload)
  },

  removeColumn(columnId: number) {
    return api.delete<{ message: string }>(`/data-catalog/columns/${columnId}`)
  },
}
