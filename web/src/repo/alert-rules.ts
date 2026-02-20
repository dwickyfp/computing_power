import { api } from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: number
  name: string
  description: string | null
  metric_type: string
  condition_operator: string
  threshold_value: number
  duration_seconds: number
  source_id: number | null
  destination_id: number | null
  pipeline_id: number | null
  notification_channels: string[] | null
  cooldown_minutes: number
  is_enabled: boolean
  last_triggered_at: string | null
  last_value: number | null
  trigger_count: number
  created_at: string
  updated_at: string
}

export interface AlertRuleCreate {
  name: string
  description?: string
  metric_type: string
  condition_operator: string
  threshold_value: number
  duration_seconds?: number
  source_id?: number | null
  destination_id?: number | null
  pipeline_id?: number | null
  notification_channels?: string[]
  cooldown_minutes?: number
  is_enabled?: boolean
  custom_query?: string
}

export interface AlertRuleUpdate {
  name?: string
  description?: string
  metric_type?: string
  condition_operator?: string
  threshold_value?: number
  duration_seconds?: number
  source_id?: number | null
  destination_id?: number | null
  pipeline_id?: number | null
  notification_channels?: string[]
  cooldown_minutes?: number
  is_enabled?: boolean
  custom_query?: string
}

export interface AlertRuleListResponse {
  items: AlertRule[]
  total: number
  page: number
  page_size: number
}

export interface AlertHistory {
  id: number
  alert_rule_id: number
  metric_value: number
  threshold_value: number
  message: string | null
  notification_sent: boolean
  resolved_at: string | null
  created_at: string
}

export interface AlertHistoryListResponse {
  items: AlertHistory[]
  total: number
  page: number
  page_size: number
}

// ─── Repository ──────────────────────────────────────────────────────────────

export const alertRulesRepo = {
  list(page = 1, pageSize = 20) {
    return api.get<AlertRuleListResponse>('/alert-rules', {
      params: { page, page_size: pageSize },
    })
  },

  get(id: number) {
    return api.get<AlertRule>(`/alert-rules/${id}`)
  },

  create(payload: AlertRuleCreate) {
    return api.post<AlertRule>('/alert-rules', payload)
  },

  update(id: number, payload: AlertRuleUpdate) {
    return api.put<AlertRule>(`/alert-rules/${id}`, payload)
  },

  remove(id: number) {
    return api.delete<{ message: string }>(`/alert-rules/${id}`)
  },

  toggle(id: number, enabled?: boolean) {
    return api.post<AlertRule>(`/alert-rules/${id}/toggle`, null, {
      params: enabled !== undefined ? { enabled } : undefined,
    })
  },

  getHistory(id: number, page = 1, pageSize = 20) {
    return api.get<AlertHistoryListResponse>(`/alert-rules/${id}/history`, {
      params: { page, page_size: pageSize },
    })
  },
}
