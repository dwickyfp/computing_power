import { api } from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: number
  name: string
  description: string | null
  metric_key: string
  condition_operator: string
  condition_value: number
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  enabled: boolean
  cooldown_minutes: number
  auto_resolve: boolean
  notify_channels: string[] | null
  last_triggered_at: string | null
  trigger_count: number
  created_at: string
  updated_at: string
}

export interface AlertRuleCreate {
  name: string
  description?: string
  metric_key: string
  condition_operator: string
  condition_value: number
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
  cooldown_minutes?: number
  auto_resolve?: boolean
}

export interface AlertRuleUpdate {
  name?: string
  description?: string
  metric_key?: string
  condition_operator?: string
  condition_value?: number
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
  cooldown_minutes?: number
  auto_resolve?: boolean
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
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  message: string | null
  resolved: boolean
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
