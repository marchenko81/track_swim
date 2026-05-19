// DO NOT MODIFY - Cayu SDK must load first to catch early errors
import './cayu-sdk'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { routeTree } from './routeTree.gen'
import { AuthProvider } from './contexts/auth-context'
import './index.css'

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultStaleTime: 5 * 60 * 1000,
  defaultPreloadStaleTime: 5 * 60 * 1000,
})

// Expose router for cayu-sdk browser automation (dev only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as any).__cayuRouter = router
}

// networkMode: 'always' — iframe apps report navigator.onLine=false which
// silently pauses all queries without this flag
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      networkMode: 'always',
      refetchOnWindowFocus: false,
    },
    mutations: {
      networkMode: 'always',
    },
  },
})

// Expose queryClient for cayu-sdk browser automation (dev only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as any).__cayuQueryClient = queryClient
}

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
