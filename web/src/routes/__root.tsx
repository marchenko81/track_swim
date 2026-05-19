import { Outlet, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider } from '@/contexts/language-context'

export const Route = createRootRoute({
  component: () => (
    <LanguageProvider>
      <ThemeProvider defaultTheme="system" storageKey="cayuUiTheme">
        <div className="min-h-screen bg-background">
          <Outlet />
        </div>
        <Toaster position="top-right" />
      </ThemeProvider>
    </LanguageProvider>
  ),
})
