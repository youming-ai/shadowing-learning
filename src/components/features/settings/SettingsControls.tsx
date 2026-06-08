'use client'

import { MinusIcon, PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SettingsButtonGroupProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

export function SettingsButtonGroup({ options, value, onChange }: SettingsButtonGroupProps) {
  return (
    <div className="settings-button-group">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`settings-button ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface SettingsSelectProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}

export function SettingsSelect({ value, onValueChange, children }: SettingsSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="w-32 rounded-lg border-2 border-[var(--border-secondary)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--state-info-text)] focus:outline-none"
      >
        {children}
      </select>
    </div>
  )
}

export function SettingsSelectItem({ value, children }: { value: string; children: ReactNode }) {
  return <option value={value}>{children}</option>
}

interface SettingsNumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export function SettingsNumberInput({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
}: SettingsNumberInputProps) {
  return (
    <div className="settings-number-adjuster">
      <button
        type="button"
        className="settings-number-button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span className="settings-number-value">{value}</span>
      <button
        type="button"
        className="settings-number-button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

interface SettingsTextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}

export function SettingsTextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: SettingsTextInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-32 rounded-lg border-2 border-[var(--border-secondary)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--state-info-text)] focus:outline-none"
    />
  )
}
