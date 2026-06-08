'use client'

import { type ReactNode, useId } from 'react'

interface SettingsCardProps {
  children: ReactNode
  className?: string
}

export function SettingsCard({ children, className = '' }: SettingsCardProps) {
  return <div className={`settings-card ${className}`}>{children}</div>
}

interface SettingsRowProps {
  children: ReactNode
  className?: string
}

export function SettingsRow({ children, className = '' }: SettingsRowProps) {
  return <div className={`settings-row ${className}`}>{children}</div>
}

interface SettingsRowContentProps {
  title: string
  description?: string
}

export function SettingsRowContent({ title, description }: SettingsRowContentProps) {
  return (
    <div className="settings-row-content">
      <h3 className="settings-row-title">{title}</h3>
      {description && <p className="settings-row-description">{description}</p>}
    </div>
  )
}

interface SettingsSectionProps {
  title: string
  children: ReactNode
  sectionKey?: string
}

export function SettingsSection({ title, children, sectionKey }: SettingsSectionProps) {
  const generatedId = useId()
  const sectionId = sectionKey ? `${sectionKey}-section` : generatedId

  return (
    <section id={sectionId} data-section={sectionKey} className="space-y-4">
      <h2 className="settings-section-title">{title}</h2>
      {children}
    </section>
  )
}
