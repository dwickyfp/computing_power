import { createFileRoute } from '@tanstack/react-router'
import { AlertRulesListPage } from '@/features/alert-rules/pages/alert-rules-list-page'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(20),
  filter: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/alert-rules/')({
  validateSearch: searchSchema,
  component: AlertRulesListPage,
})
