import { ArchedWindow, C, Head, Plant, Room, anim } from './primitives'

const PANTS_BACK = '#4f5a4f'
const SHIRT_BACK = '#96614c'

function Dumbbell({ x, y, s = 1, fill = '#55594f' }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-15" y="-3" width="30" height="6" fill="#8d8f84" />
      <rect x="-22" y="-10" width="9" height="20" rx="2" fill={fill} />
      <rect x="13" y="-10" width="9" height="20" rx="2" fill={fill} />
    </g>
  )
}

/** Bicep curls in front of the gym mirror. */
export function GymScene({ uid }: { uid: string }) {
  return (
    <>
      <Room uid={uid} wall={['#e0ddd2', '#cfccc0']} floor="#8f8d83" />
      <path d="M0 338h900v7H0z" fill="#9d9b90" />
      <rect x="60" y="56" width="780" height="206" rx="4" fill="#d6ddd9" stroke="#b8b5a8" strokeWidth="6" />
      <path d="M320 59v200m260-200v200" stroke="#b8b5a8" strokeWidth="4" />
      <path d="M120 80l60 150M400 80l40 120M650 80l50 140" stroke="#eef2ef" strokeWidth="10" opacity=".6" />
      <g transform="translate(90 0)">
        <path d="M10 338v-110m70 110v-110" stroke={C.metal} strokeWidth="8" />
        <path d="M0 250h90" stroke={C.metal} strokeWidth="6" />
        <path d="M-40 240h170" stroke="#8d8f84" strokeWidth="6" strokeLinecap="round" />
        <rect x="-38" y="218" width="12" height="44" rx="3" fill="#55594f" />
        <rect x="114" y="218" width="12" height="44" rx="3" fill="#55594f" />
      </g>
      <g transform="translate(640 270)">
        <path d="M0 0h190M0 34h190" stroke={C.metal} strokeWidth="6" />
        <path d="M6 0v68m178-68v68" stroke={C.metal} strokeWidth="6" />
        {[30, 75, 120, 160].map((x, i) => (
          <Dumbbell key={x} x={x} y={-8} s={0.8 + i * 0.07} />
        ))}
        {[40, 95, 150].map(x => (
          <Dumbbell key={x} x={x} y={26} s={1.1} fill="#6c6559" />
        ))}
      </g>
      <g transform="translate(560 316)">
        <path d="M-14 22q0-26 14-26t14 26z" fill="#55594f" />
        <path d="M-8 -2q8-14 16 0" stroke="#55594f" strokeWidth="5" fill="none" />
      </g>
      <g {...anim('breathe')}>
        <path d="M442 262v76" stroke={PANTS_BACK} strokeWidth="16" strokeLinecap="round" />
        <path d="M440 339h20" stroke={C.shoe} strokeWidth="9" strokeLinecap="round" />
        <g {...anim('lift', { '--a': '-128deg', '--d': '2.4s' }, '460px 232px', '-1.2s')}>
          <path d="M460 232v42" stroke={C.skinShade} strokeWidth="10" strokeLinecap="round" />
          <Dumbbell x={460} y={280} s={0.8} />
        </g>
        <path d="M456 186v46" stroke={SHIRT_BACK} strokeWidth="12" strokeLinecap="round" />
        <path d="M436 180q18-10 38 0l4 86h-44z" fill="#6d8b88" />
        <path d="M454 262v76" stroke={C.pants} strokeWidth="16" strokeLinecap="round" />
        <path d="M452 339h20" stroke={C.shoe} strokeWidth="9" strokeLinecap="round" />
        <path d="M448 164h14v18h-14z" fill={C.skinShade} />
        <Head x={458} y={148} r={21} facing="right" />
        <path d="M452 186v46" stroke={C.skin} strokeWidth="12" strokeLinecap="round" />
        <g {...anim('lift', { '--a': '-128deg', '--d': '2.4s' }, '452px 232px')}>
          <path d="M452 232v42" stroke={C.skin} strokeWidth="10" strokeLinecap="round" />
          <Dumbbell x={452} y={280} s={0.8} />
        </g>
      </g>
    </>
  )
}

/** Jumping jacks on a mat, beside the bed. */
export function HomeWorkoutScene({ uid }: { uid: string }) {
  const d = '1.1s'
  return (
    <>
      <Room uid={uid} />
      <ArchedWindow uid={uid} x={610} y={50} w={180} h={180} />
      <rect x="360" y="70" width="70" height="90" rx="3" fill="#b8a07d" />
      <rect x="368" y="78" width="54" height="74" fill="#e2d6b8" />
      <path d="M378 132l14-22 12 14 8-8 10 16z" fill="#8a9c86" />
      <g>
        <rect x="40" y="206" width="16" height="140" rx="4" fill={C.woodDark} />
        <rect x="40" y="206" width="260" height="30" rx="8" fill={C.wood} />
        <rect x="40" y="262" width="290" height="58" rx="10" fill="#e9e2cf" />
        <path d="M40 300h290v26H40z" fill="#c7b89a" />
        <rect x="62" y="240" width="80" height="30" rx="12" fill="#f7f2e6" />
        <path d="M200 262q60-10 130 4v34H200z" fill="#9fb0a5" />
        <path d="M320 320v24" stroke={C.woodDark} strokeWidth="10" />
      </g>
      <ellipse cx="560" cy="352" rx="110" ry="14" fill="#8fa39a" />
      <Plant x={800} y={290} s={0.8} />
      <g {...anim('bob', { '--y': '-10px', '--d': d })}>
        <g {...anim('lift', { '--a': '14deg', '--d': d }, '552px 266px')}>
          <path d="M552 266v72" stroke={C.pants} strokeWidth="16" strokeLinecap="round" />
          <path d="M542 340h14" stroke={C.shoe} strokeWidth="9" strokeLinecap="round" />
        </g>
        <g {...anim('lift', { '--a': '-14deg', '--d': d }, '568px 266px')}>
          <path d="M568 266v72" stroke={C.pants} strokeWidth="16" strokeLinecap="round" />
          <path d="M564 340h14" stroke={C.shoe} strokeWidth="9" strokeLinecap="round" />
        </g>
        <g {...anim('lift', { '--a': '155deg', '--d': d }, '538px 192px')}>
          <path d="M538 192l-4 64" stroke={C.skin} strokeWidth="11" strokeLinecap="round" />
        </g>
        <g {...anim('lift', { '--a': '-155deg', '--d': d }, '582px 192px')}>
          <path d="M582 192l4 64" stroke={C.skin} strokeWidth="11" strokeLinecap="round" />
        </g>
        <path d="M536 186q24-12 48 0l-4 86h-40z" fill={C.shirt} />
        <path d="M553 166h14v20h-14z" fill={C.skinShade} />
        <Head x={560} y={148} r={22} />
      </g>
    </>
  )
}
