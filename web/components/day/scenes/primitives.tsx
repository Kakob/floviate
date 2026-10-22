import type { CSSProperties, ReactNode } from 'react'
import styles from '../scene.module.css'

/** Shared palette so every scene reads as the same little world. */
export const C = {
  wall: '#ece7da',
  wallShade: '#dcd7c9',
  floor: '#c4beaa',
  floorEdge: '#d5cebb',
  skin: '#cfa380',
  skinShade: '#c39371',
  hair: '#47483c',
  shirt: '#ad725a',
  pants: '#5f6b5e',
  shoe: '#3f4238',
  wood: '#968062',
  woodDark: '#78694f',
  sage: '#829082',
  leaf: '#647d65',
  paper: '#f6eed8',
  cream: '#f5f0e3',
  steam: '#fff9e8',
  lamp: '#d4b77d',
  glow: '#fff4bf',
  sky: '#94b5b1',
  skyLow: '#e5dac0',
  hill: '#819784',
  hillDark: '#526f61',
  metal: '#626e66',
  screen: '#c5d6be',
  up: '#6f9a78',
  down: '#b9735f',
}

/** Inline animation parameters for the scene.module.css vocabulary. */
export function vars(values: Record<string, string>, extra: CSSProperties = {}): CSSProperties {
  return { ...values, ...extra } as CSSProperties
}

export { styles }

type AnimationName = 'swing' | 'bob' | 'scroll' | 'spin' | 'turn' | 'rise' | 'glow' | 'drip' | 'lift' | 'puff' | 'slide' | 'steam' | 'cursor' | 'breathe'

/**
 * Props for an animated element: anim('swing', { '--a': '20deg', '--d': '.6s' }, '450px 290px').
 * The origin is in the element's local SVG coordinates. A negative delay offsets the phase.
 */
export function anim(name: AnimationName, values: Record<string, string> = {}, origin?: string, delay?: string) {
  return {
    className: styles[name],
    style: vars(values, { ...(origin ? { transformOrigin: origin } : {}), ...(delay ? { animationDelay: delay } : {}) }),
  }
}

export function Room({ uid, floorY = 338, wall = [C.wall, C.wallShade], floor = C.floor }: {
  uid: string
  floorY?: number
  wall?: [string, string]
  floor?: string
}) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-wall`} x2="0" y2="1">
          <stop stopColor={wall[0]} />
          <stop offset="1" stopColor={wall[1]} />
        </linearGradient>
      </defs>
      <path fill={`url(#${uid}-wall)`} d="M0 0h900v440H0z" />
      <path fill={floor} d={`M0 ${floorY}h900v${440 - floorY}H0z`} />
      <path fill={C.floorEdge} d={`M0 ${floorY}h900v7H0z`} />
    </>
  )
}

/** Arched window onto hills, with drifting clouds. */
export function ArchedWindow({ uid, x, y, w = 234, h = 222 }: { uid: string; x: number; y: number; w?: number; h?: number }) {
  const r = Math.min(w, h) / 2.3
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-win-sky`} x2="0" y2="1">
          <stop stopColor={C.sky} />
          <stop offset="1" stopColor={C.skyLow} />
        </linearGradient>
        <clipPath id={`${uid}-win-clip`}>
          <rect x={x} y={y} width={w} height={h} rx={r} />
        </clipPath>
      </defs>
      <rect x={x - 10} y={y - 10} width={w + 20} height={h + 22} rx={r + 10} fill={C.cream} />
      <g clipPath={`url(#${uid}-win-clip)`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-win-sky)`} />
        <circle cx={x + w * 0.73} cy={y + h * 0.29} r={w * 0.13} fill="#f8e5b0" />
        <g className={styles.cloud} fill="#eef0dc" opacity=".5">
          <ellipse cx={x + w * 0.25} cy={y + h * 0.34} rx={w * 0.26} ry="10" />
          <ellipse cx={x + w * 0.85} cy={y + h * 0.53} rx={w * 0.22} ry="8" />
        </g>
        <path d={`M${x - 17} ${y + h * 0.8}q${w * 0.38}-${h * 0.34} ${w * 0.68}-${h * 0.05}t${w * 0.47}-${h * 0.08}v${h * 0.4}H${x - 17}`} fill={C.hill} />
        <path d={`M${x - 19} ${y + h * 0.93}q${w * 0.3}-${h * 0.25} ${w * 0.62}-${h * 0.07}t${w * 0.52}-${h * 0.01}v${h * 0.23}H${x - 19}`} fill={C.hillDark} />
      </g>
      <path d={`M${x + w / 2} ${y + 1}v${h - 2}m-${w / 2 - 1}-${h * 0.42}h${w - 2}`} stroke="#f4eedf" strokeWidth="8" />
      <rect x={x - 17} y={y + h} width={w + 34} height="13" rx="4" fill="#a49e87" />
    </>
  )
}

/** A soft pool of lamplight that breathes slowly. */
export function LampGlow({ uid, id, cx, cy, rx, ry, d = '5s' }: { uid: string; id: string; cx: number; cy: number; rx: number; ry: number; d?: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-${id}`}>
          <stop stopColor={C.glow} stopOpacity=".8" />
          <stop offset="1" stopColor={C.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse {...anim('glow', { '--d': d, '--from': '.6' })} cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${uid}-${id})`} />
    </>
  )
}

export function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={styles.swing} style={vars({ '--a': '1.5deg', '--d': '3.5s' }, { transformOrigin: '28px 12px' })}>
        <path d="M27 12q-8-89 13-142m-12 96q-53-21-38-55 37 4 38 55m5-40q5-55 42-49 1 36-42 49m-2 65q30-45 54-24-15 29-54 24" fill={C.leaf} stroke={C.leaf} strokeWidth="4" />
      </g>
      <path d="m0 0 58 0-9 60h-40z" fill="#b98d73" />
      <path d="M-2 -1h62v10h-62" fill="#c39a80" />
    </g>
  )
}

/** Two curling wisps of steam rising from (x, y). */
export function Steam({ x, y, delay = '0s' }: { x: number; y: number; delay?: string }) {
  return (
    <path
      className={styles.steam}
      style={{ animationDelay: delay }}
      d={`M${x} ${y}q-9-9 1-18m9 16q8-9 0-18`}
      fill="none"
      stroke={C.steam}
      strokeWidth="3"
      strokeLinecap="round"
    />
  )
}

export function Mug({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path d={`M${x} ${y}h24v25h-24z`} fill="#e6d7b5" />
      <path d={`M${x + 24} ${y + 4}q19-2 11 15h-11`} fill="none" stroke="#e6d7b5" strokeWidth="5" />
      <Steam x={x + 6} y={y - 10} />
    </>
  )
}

/** A head in profile or facing forward, with the shared hairstyle. */
export function Head({ x, y, r = 26, facing = 'front' }: { x: number; y: number; r?: number; facing?: 'front' | 'right' | 'left' }) {
  const flip = facing === 'left' ? -1 : 1
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <ellipse rx={r} ry={r * 1.12} fill={C.skin} />
      {facing === 'front' ? (
        <path d={`M${-r} ${r * 0.05}q${-r * 0.4}-${r * 1.7} ${r}-${r * 1.2}q${r * 1.3} ${r * 0.1} ${r * 1.08} ${r * 1.3}l-${r * 0.4}-${r * 0.2}-${r * 0.3}-${r * 0.5}q-${r * 0.2} ${r * 0.6}-${r * 1.3} ${r * 0.9}`} fill={C.hair} />
      ) : (
        <path d={`M${-r * 1.02} ${r * 0.2}q-${r * 0.1}-${r * 1.5} ${r * 1.1}-${r * 1.35}q${r * 0.8} 0 ${r * 0.9} ${r * 0.6}l-${r * 0.7} ${r * 0.1}q-${r * 0.3} ${r * 0.4}-${r * 0.4} ${r * 1.1}z`} fill={C.hair} />
      )}
    </g>
  )
}

/** Sky, sun, and drifting clouds for outdoor scenes. */
export function OutdoorSky({ uid, top = C.sky, bottom = C.skyLow, sun = '#f8e5b0' }: { uid: string; top?: string; bottom?: string; sun?: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-sky`} x2="0" y2="1">
          <stop stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <path fill={`url(#${uid}-sky)`} d="M0 0h900v440H0z" />
      <circle cx="720" cy="86" r="38" fill={sun} />
      <g className={styles.cloud} fill="#eef0dc" opacity=".6">
        <ellipse cx="180" cy="80" rx="80" ry="13" />
        <ellipse cx="520" cy="120" rx="60" ry="10" />
      </g>
    </>
  )
}

/**
 * Scenery that loops seamlessly: children are drawn once across x 0–900 and repeated.
 * Slower durations read as further away.
 */
export function Scroll({ d, children }: { d: string; children: ReactNode }) {
  return (
    <g className={styles.scroll} style={vars({ '--d': d })}>
      {children}
      <g transform="translate(900 0)">{children}</g>
    </g>
  )
}

export function Tree({ x, ground, s = 1, tone = C.leaf }: { x: number; ground: number; s?: number; tone?: string }) {
  return (
    <g transform={`translate(${x} ${ground}) scale(${s})`}>
      <path d="M-4 0v-58h8v58z" fill={C.woodDark} />
      <ellipse cy="-86" rx="34" ry="42" fill={tone} />
      <ellipse cx="-14" cy="-70" rx="20" ry="18" fill={tone} opacity=".8" />
    </g>
  )
}

export function Hills({ y = 250 }: { y?: number }) {
  return (
    <>
      <path d={`M0 ${y}q120-60 260-10t300-20 340 10v${440 - y}H0z`} fill={C.hill} opacity=".7" />
      <path d={`M0 ${y + 30}q160-40 330 0t320-10 250 5v${410 - y}H0z`} fill={C.hillDark} opacity=".55" />
    </>
  )
}
