import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/alert-rules')({
  component: () => <Outlet />,
})
