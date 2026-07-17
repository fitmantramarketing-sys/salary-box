import { useCallback } from 'react'
import { Input } from './input'
import { Button } from './button'

interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}

function to24(h: number, min: string, isPM: boolean): string {
  const mm = min.padStart(2, '0')
  if (isPM) return `${h === 12 ? 12 : h + 12}`.padStart(2, '0') + ':' + mm
  return `${h === 12 ? 0 : h}`.padStart(2, '0') + ':' + mm
}

function from24(v: string): { h: number; min: string; isPM: boolean } | null {
  if (!v) return null
  const parts = v.split(':')
  if (parts.length !== 2) return null
  const h24 = parseInt(parts[0], 10)
  const min = parts[1]?.padStart(2, '0') ?? '00'
  if (isNaN(h24)) return null
  const isPM = h24 >= 12
  const h = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24
  return { h, min, isPM }
}

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const parsed = from24(value ?? '')

  const set = useCallback(
    (h: number, min: string, isPM: boolean) => {
      onChange(to24(h, min, isPM))
    },
    [onChange]
  )

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={1}
        max={12}
        value={parsed?.h.toString() ?? ''}
        onChange={(e) => {
          let h = parseInt(e.target.value, 10)
          if (isNaN(h) || h < 1) h = 1
          if (h > 12) h = 12
          set(h, parsed?.min ?? '00', parsed?.isPM ?? true)
        }}
        className="w-12 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        disabled={disabled}
      />
      <span className="text-muted-foreground text-sm">:</span>
      <Input
        type="number"
        min={0}
        max={59}
        value={parsed?.min ?? ''}
        onChange={(e) => {
          let min = parseInt(e.target.value, 10)
          if (isNaN(min) || min < 0) min = 0
          if (min > 59) min = 59
          set(parsed?.h ?? 12, min.toString(), parsed?.isPM ?? true)
        }}
        className="w-12 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          set(parsed?.h ?? 12, parsed?.min ?? '00', !(parsed?.isPM ?? true))
        }}
        className="w-14"
      >
        {parsed?.isPM ?? true ? 'PM' : 'AM'}
      </Button>
    </div>
  )
}
