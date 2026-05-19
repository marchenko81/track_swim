import * as WebBrowser from 'expo-web-browser'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Notifications from 'expo-notifications'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Linking, Platform, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { AvatarBadge, SectionCard } from '@/src/components/common'
import { api } from '@/src/api/client'
import { useAuthStore } from '@/src/stores/auth-store'
import type { UserProfile } from '@/src/types/domain'

type NotificationPrefs = Pick<
  UserProfile,
  'daily_session_reminders_enabled' | 'daily_session_reminder_time' | 'coach_messages_notifications_enabled' | 'timezone'
>

function parseReminderTime(value?: string) {
  const [hours = '07', minutes = '00'] = (value ?? '07:00').split(':')
  const date = new Date()
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return date
}

function formatReminderTime(value: string) {
  return parseReminderTime(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function toApiTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function AthleteSettingsScreen() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const logout = useAuthStore((state) => state.logout)

  const [permissionsGranted, setPermissionsGranted] = useState<boolean | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    daily_session_reminders_enabled: user?.daily_session_reminders_enabled ?? true,
    daily_session_reminder_time: user?.daily_session_reminder_time ?? '07:00',
    coach_messages_notifications_enabled: user?.coach_messages_notifications_enabled ?? true,
    timezone: user?.timezone ?? 'UTC',
  })

  useEffect(() => {
    if (!user) return
    setNotificationPrefs({
      daily_session_reminders_enabled: user.daily_session_reminders_enabled,
      daily_session_reminder_time: user.daily_session_reminder_time,
      coach_messages_notifications_enabled: user.coach_messages_notifications_enabled,
      timezone: user.timezone,
    })
  }, [user])

  useEffect(() => {
    let isMounted = true

    async function syncScreenContext() {
      const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

      if (user && user.timezone !== deviceTimezone) {
        try {
          const next = await updateProfile({ timezone: deviceTimezone })
          if (isMounted) {
            setNotificationPrefs((current) => ({ ...current, timezone: next.timezone }))
          }
        } catch {
          // keep local state unchanged; preferences can still be edited
        }
      }

      if (Platform.OS === 'web') {
        if (isMounted) setPermissionsGranted(true)
        return
      }

      const permission = await Notifications.getPermissionsAsync()
      const granted = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      if (isMounted) setPermissionsGranted(granted)
    }

    void syncScreenContext()
    return () => {
      isMounted = false
    }
  }, [updateProfile, user])

  const reminderTimeLabel = useMemo(
    () => formatReminderTime(notificationPrefs.daily_session_reminder_time),
    [notificationPrefs.daily_session_reminder_time],
  )

  async function connectStrava() {
    const { data } = await api.get('/strava/auth-url/')
    await WebBrowser.openBrowserAsync(data.auth_url)
  }

  async function saveNotificationPrefs(nextPrefs: NotificationPrefs) {
    setNotificationError(null)
    setIsSavingNotifications(true)
    try {
      const saved = await updateProfile(nextPrefs)
      setNotificationPrefs({
        daily_session_reminders_enabled: saved.daily_session_reminders_enabled,
        daily_session_reminder_time: saved.daily_session_reminder_time,
        coach_messages_notifications_enabled: saved.coach_messages_notifications_enabled,
        timezone: saved.timezone,
      })
      Alert.alert(t('common.success'), t('settings.saved'))
    } catch {
      setNotificationError(t('settings.save_failed'))
    } finally {
      setIsSavingNotifications(false)
    }
  }

  function handleTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') {
      setShowTimePicker(false)
    }
    if (event.type !== 'set' || !selectedDate) return
    const nextPrefs = {
      ...notificationPrefs,
      daily_session_reminder_time: toApiTime(selectedDate),
    }
    setNotificationPrefs(nextPrefs)
    void saveNotificationPrefs(nextPrefs)
  }

  return (
    <AppScreen title={t('settings.settings')} right={<AvatarBadge firstName={user?.first_name} lastName={user?.last_name} />}>
      <SectionCard title={t('profile.edit_profile')}>
        <Input value={user?.first_name} onChangeText={(value) => updateProfile({ first_name: value })} />
        <Input value={user?.last_name} onChangeText={(value) => updateProfile({ last_name: value })} />
        <Input value={user?.email} editable={false} />
      </SectionCard>

      <SectionCard title={t('settings.language')}>
        <View className="flex-row gap-3">
          <Button className={`flex-1 rounded-2xl ${i18n.language === 'en' ? 'bg-sky-500' : 'bg-slate-100'}`} onPress={() => updateProfile({ language: 'en' })}>
            <Text className={i18n.language === 'en' ? 'text-white' : 'text-slate-900'}>EN</Text>
          </Button>
          <Button className={`flex-1 rounded-2xl ${i18n.language === 'ru' ? 'bg-sky-500' : 'bg-slate-100'}`} onPress={() => updateProfile({ language: 'ru' })}>
            <Text className={i18n.language === 'ru' ? 'text-white' : 'text-slate-900'}>RU</Text>
          </Button>
        </View>
      </SectionCard>

      <SectionCard title={t('settings.notifications')}>
        <View className="gap-5">
          <View className="gap-4 rounded-[24px] bg-slate-50 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-base font-semibold text-slate-900">{t('settings.daily_session_reminders')}</Text>
                <Text className="text-sm leading-5 text-slate-500">{t('settings.daily_session_reminders_hint')}</Text>
              </View>
              <Switch
                checked={notificationPrefs.daily_session_reminders_enabled}
                onCheckedChange={(checked) => {
                  const nextPrefs = { ...notificationPrefs, daily_session_reminders_enabled: !!checked }
                  setNotificationPrefs(nextPrefs)
                  void saveNotificationPrefs(nextPrefs)
                }}
              />
            </View>

            {notificationPrefs.daily_session_reminders_enabled ? (
              <Button variant="outline" className="items-start rounded-2xl border-slate-200 bg-white px-4 py-4" onPress={() => setShowTimePicker(true)}>
                <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-slate-500">{t('settings.reminder_time')}</Text>
                <Text className="mt-1 text-lg font-semibold text-slate-900">{reminderTimeLabel}</Text>
              </Button>
            ) : (
              <Text className="text-sm text-slate-500">{t('settings.reminder_time_hidden')}</Text>
            )}
          </View>

          <View className="gap-4 rounded-[24px] bg-slate-50 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-base font-semibold text-slate-900">{t('settings.coach_messages_feedback')}</Text>
                <Text className="text-sm leading-5 text-slate-500">{t('settings.coach_messages_feedback_hint')}</Text>
              </View>
              <Switch
                checked={notificationPrefs.coach_messages_notifications_enabled}
                onCheckedChange={(checked) => {
                  const nextPrefs = { ...notificationPrefs, coach_messages_notifications_enabled: !!checked }
                  setNotificationPrefs(nextPrefs)
                  void saveNotificationPrefs(nextPrefs)
                }}
              />
            </View>
          </View>

          {permissionsGranted === false ? (
            <View className="gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm leading-5 text-amber-900">{t('settings.notifications_disabled_device')}</Text>
              <Button variant="outline" className="rounded-2xl border-amber-300" onPress={() => Linking.openSettings()}>
                <Text>{t('settings.open_settings')}</Text>
              </Button>
            </View>
          ) : null}

          <Text className="text-xs text-slate-500">
            {isSavingNotifications ? t('settings.saving') : `${t('settings.timezone')}: ${notificationPrefs.timezone}`}
          </Text>
          {notificationError ? <Text className="text-sm font-medium text-rose-600">{notificationError}</Text> : null}
        </View>
      </SectionCard>

      <SectionCard title={t('strava.connect')}>
        <Button className="rounded-2xl bg-sky-500" onPress={connectStrava}>
          <Text className="text-white">{t('strava.connect')}</Text>
        </Button>
      </SectionCard>

      <Button
        variant="destructive"
        className="rounded-2xl"
        onPress={() =>
          Alert.alert(t('mobile.log_out'), t('mobile.log_out_confirm'), [
            { text: t('common.cancel') },
            { text: t('mobile.log_out'), style: 'destructive', onPress: () => logout() },
          ])
        }
      >
        <Text className="text-white">{t('mobile.log_out')}</Text>
      </Button>

      {showTimePicker ? (
        <DateTimePicker
          value={parseReminderTime(notificationPrefs.daily_session_reminder_time)}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      ) : null}
    </AppScreen>
  )
}
