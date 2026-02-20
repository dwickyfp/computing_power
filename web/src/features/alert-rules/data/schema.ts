import { z } from 'zod'

// ─── Alert Rule ──────────────────────────────────────────────────────────────

export const alertRuleSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  metric_type: z.string(),
  condition_operator: z.string(),
  threshold_value: z.number(),
  duration_seconds: z.number(),
  source_id: z.number().nullable(),
  destination_id: z.number().nullable(),
  pipeline_id: z.number().nullable(),
  notification_channels: z.array(z.string()).nullable(),
  cooldown_minutes: z.number(),
  is_enabled: z.boolean(),
  last_triggered_at: z.string().nullable(),
  last_value: z.number().nullable(),
  trigger_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type AlertRule = z.infer<typeof alertRuleSchema>

export const alertRuleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  metric_type: z.string().min(1, 'Metric is required'),
  condition_operator: z.string().min(1, 'Operator is required'),
  threshold_value: z.coerce.number(),
  cooldown_minutes: z.coerce.number().min(0).default(15),
  is_enabled: z.boolean().default(true),
})

export type AlertRuleForm = z.infer<typeof alertRuleFormSchema>

// ─── Alert History ───────────────────────────────────────────────────────────

export const alertHistorySchema = z.object({
  id: z.number(),
  alert_rule_id: z.number(),
  metric_value: z.number(),
  threshold_value: z.number(),
  message: z.string().nullable(),
  notification_sent: z.boolean(),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
})

export type AlertHistory = z.infer<typeof alertHistorySchema>
