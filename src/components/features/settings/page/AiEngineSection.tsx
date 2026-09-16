'use client'

import { useState } from 'react'
import {
  SettingsCard,
  SettingsRow,
  SettingsRowContent,
  SettingsSection,
} from '~/components/features/settings/SettingsCard'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { AI_PROVIDERS, findProvider, SERVER_ENGINE_ID } from '~/lib/ai/catalog'
import {
  clearStoredKey,
  getSelectedEngineId,
  getStoredKey,
  getStoredModel,
  maskKey,
  setSelectedEngineId,
  setStoredKey,
  setStoredModel,
} from '~/lib/ai/keys'

/**
 * AI 引擎设置：在「服务器默认额度」与「自带 key 直连」之间切换。
 *
 * 默认路径刻意是零配置的服务器额度 —— 大多数用户不该为了用翻译去申请一个 API key。
 * 自带 key 是给"想用自己的额度、且不想让密钥经过我们服务器"的用户的可选项。
 *
 * 界面上必须如实说明 key 的去向与风险（见下方提示文案），不要含糊其辞。
 */
export function AiEngineSection() {
  const { t } = useI18n()
  const [engineId, setEngineId] = useState(() => getSelectedEngineId())
  const [draftKey, setDraftKey] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)

  const provider = findProvider(engineId)
  const storedKey = provider ? getStoredKey(provider.id) : null
  const [model, setModel] = useState(() =>
    provider ? (getStoredModel(provider.id) ?? provider.defaultModel) : '',
  )

  const selectEngine = (id: string) => {
    setSelectedEngineId(id)
    setEngineId(id)
    setDraftKey('')
    setSavedNotice(false)
    const next = findProvider(id)
    setModel(next ? (getStoredModel(next.id) ?? next.defaultModel) : '')
  }

  const saveKey = () => {
    if (!provider || draftKey.trim().length === 0) return
    setStoredKey(provider.id, draftKey)
    setDraftKey('')
    setSavedNotice(true)
  }

  const saveModel = () => {
    if (!provider || model.trim().length === 0) return
    setStoredModel(provider.id, model)
    setSavedNotice(true)
  }

  const removeKey = () => {
    if (!provider) return
    clearStoredKey(provider.id)
    setSavedNotice(false)
    // 没有 key 就无法直连，回到默认额度，避免留下一个必然失败的选项
    selectEngine(SERVER_ENGINE_ID)
  }

  return (
    <SettingsSection title={t('settings.ai.title')} sectionKey="ai-engine">
      <SettingsCard>
        <SettingsRow>
          <SettingsRowContent
            title={t('settings.ai.engine')}
            description={t('settings.ai.engineHint')}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectEngine(SERVER_ENGINE_ID)}
              className={`btn-secondary !h-9 !rounded-full !px-3 text-xs ${
                engineId === SERVER_ENGINE_ID
                  ? '!border-[var(--rhythm-beat)] !text-[var(--rhythm-beat)]'
                  : ''
              }`}
              aria-pressed={engineId === SERVER_ENGINE_ID}
            >
              {t('settings.ai.engineDefault')}
            </button>
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectEngine(p.id)}
                className={`btn-secondary !h-9 !rounded-full !px-3 text-xs ${
                  engineId === p.id ? '!border-[var(--rhythm-beat)] !text-[var(--rhythm-beat)]' : ''
                }`}
                aria-pressed={engineId === p.id}
              >
                {p.label}
              </button>
            ))}
          </div>
        </SettingsRow>

        {provider && (
          <>
            <SettingsRow>
              <SettingsRowContent
                title={t('settings.ai.apiKey')}
                description={
                  storedKey
                    ? maskKey(storedKey)
                    : t('settings.ai.apiKeyHint', { provider: provider.label })
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  value={draftKey}
                  onChange={(e) => setDraftKey(e.target.value)}
                  placeholder={t('settings.ai.apiKeyPlaceholder')}
                  className="h-9 w-64 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={saveKey}
                  disabled={draftKey.trim().length === 0}
                  className="btn-primary !h-9 !px-4 text-xs"
                >
                  {t('settings.ai.save')}
                </button>
                {storedKey && (
                  <button
                    type="button"
                    onClick={removeKey}
                    className="btn-secondary !h-9 !rounded-full !px-3 text-xs"
                  >
                    {t('settings.ai.clear')}
                  </button>
                )}
                <a
                  href={provider.keysUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-[var(--rhythm-beat)] underline"
                >
                  {t('settings.ai.getKey', { provider: provider.label })}
                </a>
              </div>
            </SettingsRow>

            <SettingsRow>
              <SettingsRowContent
                title={t('settings.ai.model')}
                description={t('settings.ai.modelHint')}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  list={`ai-models-${provider.id}`}
                  className="h-9 w-64 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
                  spellCheck={false}
                />
                <datalist id={`ai-models-${provider.id}`}>
                  {provider.suggestedModels.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={saveModel}
                  className="btn-secondary !h-9 !rounded-full !px-3 text-xs"
                >
                  {t('settings.ai.save')}
                </button>
              </div>
            </SettingsRow>

            <div className="px-4 pb-4 text-xs text-[var(--text-tertiary)]">
              <p>{t('settings.ai.privacy')}</p>
              {savedNotice && (
                <p className="mt-1 text-[var(--rhythm-ontime)]">{t('settings.ai.saved')}</p>
              )}
            </div>
          </>
        )}

        {!provider && (
          <div className="px-4 pb-4 text-xs text-[var(--text-tertiary)]">
            <p>{t('settings.ai.defaultQuotaHint')}</p>
            {savedNotice && (
              <p className="mt-1 text-[var(--rhythm-ontime)]">{t('settings.ai.saved')}</p>
            )}
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}
