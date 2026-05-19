import { useLanguage } from '@/contexts/language-context'
import type { Language } from '@/lib/translations'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage()

  const handleSwitch = (newLang: Language) => {
    if (newLang !== lang) setLang(newLang)
  }

  return (
    <div className={cn('flex items-center gap-0 text-sm', className)}>
      <button
        onClick={() => handleSwitch('en')}
        className={cn(
          'px-1.5 py-0.5 rounded transition-colors',
          lang === 'en'
            ? 'font-semibold text-foreground underline underline-offset-2'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        EN
      </button>
      <span className="text-muted-foreground/50 select-none">|</span>
      <button
        onClick={() => handleSwitch('ru')}
        className={cn(
          'px-1.5 py-0.5 rounded transition-colors',
          lang === 'ru'
            ? 'font-semibold text-foreground underline underline-offset-2'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        RU
      </button>
    </div>
  )
}
