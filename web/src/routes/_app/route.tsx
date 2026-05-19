import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { BottomNav } from '@/components/bottom-nav'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate({ to: '/login' })
    } else if (!user.onboarding_completed) {
      navigate({ to: '/onboarding' })
    }
  }, [user, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!user || !user.onboarding_completed) return null

  return (
    <div className="bg-background pb-20">
      <Outlet />
      <BottomNav role={user.role} />
    </div>
  )
}
