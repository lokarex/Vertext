import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { error as logError } from '@tauri-apps/plugin-log'

export function useErrorHandler() {
  const message = useMessage()
  const { t } = useI18n()

  function handleError(i18nKey: string, err: unknown) {
    const errStr = String(err)
    logError(`${i18nKey}: ${errStr}`)
    message.error(t(i18nKey, { error: errStr }))
  }

  return { handleError }
}
