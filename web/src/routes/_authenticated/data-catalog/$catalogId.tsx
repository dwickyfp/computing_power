import { createFileRoute } from '@tanstack/react-router'
import { DataCatalogDetailPage } from '@/features/data-catalog/pages/data-catalog-detail-page'
import { z } from 'zod'

export const Route = createFileRoute(
  '/_authenticated/data-catalog/$catalogId',
)({
  component: DataCatalogDetailPage,
  parseParams: (params) => ({
    catalogId: z.number().int().parse(Number(params.catalogId)),
  }),
})
