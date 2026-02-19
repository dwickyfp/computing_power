import { createFileRoute } from '@tanstack/react-router'
import { DataCatalogListPage } from '@/features/data-catalog/pages/data-catalog-list-page'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(20),
  filter: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/data-catalog/')({
  validateSearch: searchSchema,
  component: DataCatalogListPage,
})
