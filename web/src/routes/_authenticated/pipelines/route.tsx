import { createFileRoute, Outlet } from '@tanstack/react-router'
import { PipelinesLayout } from '@/features/pipelines/layout/pipelines-layout'

export const Route = createFileRoute('/_authenticated/pipelines')({
    component: () => (
        <PipelinesLayout>
            <Outlet />
        </PipelinesLayout>
    ),
})
