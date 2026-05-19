import {
  LayoutDashboardIcon,
  UsersIcon,
  FolderIcon,
  SettingsIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavMain } from "@/components/nav-main"
import { ThemeToggle } from "@/components/theme-toggle"
import { useLanguage } from "@/contexts/language-context"

interface User {
  id: number
  name: string
  email: string
}

interface AppSidebarProps {
  user: User
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { t } = useLanguage()

  const navMain = [
    { title: t('nav.today'), url: "/", icon: LayoutDashboardIcon },
    { title: t('nav.team'), url: "/users", icon: UsersIcon },
    { title: t('nav.plans'), url: "/projects", icon: FolderIcon },
    { title: t('settings.settings'), url: "/settings", icon: SettingsIcon },
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="flex aspect-square h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
            <span className="text-sm font-bold">A</span>
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-semibold">App Name</span>
            <span className="text-xs text-muted-foreground">Workspace</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            {user.email}
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
