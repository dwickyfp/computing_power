import { z } from 'zod'

// ─── Alert Rule ──────────────────────────────────────────────────────────────

export const alertRuleSeverityValues = ['INFO', 'WARNING', 'CRITICAL'] as const
export type AlertRuleSeverity = (typeof alertRuleSeverityValues)[number]

export const alertRuleSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  metric_key: z.string(),
  condition_operator: z.string(),
  condition_value: z.number(),
  severity: z.enum(alertRuleSeverityValues),
  enabled: z.boolean(),
  cooldown_minutes: z.number(),
  auto_resolve: z.boolean(),
  notify_channels: z.any().nullable(),
  last_triggered_at: z.string().nullable(),
  trigger_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type AlertRule = z.infer<typeof alertRuleSchema>

export const alertRuleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  metric_key: z.string().min(1, 'Metric key is required'),
  condition_operator: z.string().min(1, 'Operator is required'),
  condition_value: z.coerce.number(),
  severity: z.enum(alertRuleSeverityValues).default('WARNING'),
  cooldown_minutes: z.coerce.number().min(0).default(15),
  auto_resolve: z.boolean().default(true),
})

export type AlertRuleForm = z.infer<typeof alertRuleFormSchema>

// ─── Alert History ───────────────────────────────────────────────────────────

export const alertHistorySchema = z.object({
  id: z.number(),
  rule_id: z.number(),
  metric_value: z.number(),
  severity: z.enum(alertRuleSeverityValues),
  message: z.string().nullable(),
  resolved: z.boolean(),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
})

export type AlertHistory = z.infer<typeof alertHistorySchema>
