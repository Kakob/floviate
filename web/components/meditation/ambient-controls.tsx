'use client'

import { CloudRain, Waves } from 'lucide-react'
import type { AmbientSettings } from '@/lib/meditation/types'

export function AmbientControls({ value, onChange }: { value: AmbientSettings; onChange: (value: AmbientSettings) => void }) {
  return <div className="med-ambient-grid">{(['brownNoise', 'rain'] as const).map(key => {
    const label = key === 'rain' ? 'Rain' : 'Brown noise'
    const Icon = key === 'rain' ? CloudRain : Waves
    return <div className={`med-ambient ${value[key].enabled ? 'is-enabled' : ''}`} key={key}>
      <label className="med-toggle-row"><span><Icon size={19} />{label}</span><input aria-label={label} type="checkbox" checked={value[key].enabled} onChange={e => onChange({ ...value, [key]: { ...value[key], enabled: e.target.checked } })} /></label>
      <label className="med-volume"><span>{label} volume <b>{Math.round(value[key].volume * 100)}%</b></span><input aria-label={`${label} volume`} type="range" min="0" max="100" value={Math.round(value[key].volume * 100)} onChange={e => onChange({ ...value, [key]: { ...value[key], volume: Number(e.target.value) / 100 } })} /></label>
    </div>
  })}</div>
}
