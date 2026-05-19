import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/insights')({
  component: InsightsPage,
})

function InsightsPage() {
  return (
    <Outlet />
  )
}
