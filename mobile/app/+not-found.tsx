import { Link } from 'expo-router'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'

export default function NotFoundScreen() {
  return (
    <AppScreen title="Page not found">
      <Link href="/(athlete)" asChild>
        <Button className="rounded-2xl bg-sky-500"><Text className="text-white">Go home</Text></Button>
      </Link>
    </AppScreen>
  )
}
