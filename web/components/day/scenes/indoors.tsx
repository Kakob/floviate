import { ArchedWindow, C, Head, LampGlow, Mug, Plant, Room, Steam, anim } from './primitives'

const SHIRT_BACK = '#96614c'

/** Seated in profile at a table, facing right, hip at (x, seatY). */
function SeatedSide({ x, seatY, shirt = C.shirt }: { x: number; seatY: number; shirt?: string }) {
  return (
    <>
      <path d={`M${x} ${seatY}h46v56`} stroke={C.pants} strokeWidth="15" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M${x - 16} ${seatY + 8}q-6-66 10-82q18-8 30 4l4 78z`} fill={shirt} />
      <path d={`M${x - 3} ${seatY - 92}h14v16h-14z`} fill={C.skinShade} />
      <Head x={x + 6} y={seatY - 106} r={21} facing="right" />
    </>
  )
}

export function EatingScene({ uid }: { uid: string }) {
  return (
    <>
      <Room uid={uid} />
      <ArchedWindow uid={uid} x={96} y={46} w={200} h={200} />
      <g {...anim('swing', { '--a': '1.2deg', '--d': '4s' }, '600px 0px')}>
        <path d="M600 0v112" stroke="#8b8065" strokeWidth="3" />
        <path d="M572 140q28-44 56 0z" fill={C.lamp} />
        <LampGlow uid={uid} id="pendant" cx={600} cy={170} rx={80} ry={60} d="4s" />
      </g>
      <rect x="330" y="224" width="16" height="116" rx="4" fill="#829082" />
      <rect x="318" y="290" width="70" height="12" rx="4" fill="#829082" />
      <path d="M326 302v58m54-58v58" stroke="#696c5b" strokeWidth="8" />
      <SeatedSide x={356} seatY={292} />
      <path d="M420 300v70m260-70v70" stroke={C.woodDark} strokeWidth="12" />
      <rect x="400" y="290" width="300" height="14" rx="5" fill={C.wood} />
      <ellipse cx="478" cy="289" rx="44" ry="7" fill={C.cream} />
      <ellipse cx="478" cy="284" rx="22" ry="6" fill="#c98f5f" />
      <circle cx="490" cy="280" r="5" fill="#8a9c6a" />
      <path d="M572 266q30 30 60 0z" fill="#e6d7b5" />
      <Steam x={594} y={258} />
      <Steam x={608} y={254} delay="-2s" />
      <path d="M654 258h18l-3 32h-12z" fill="#dfe9e3" opacity=".8" />
      <path d="M656 270h14l-2 18h-10z" fill="#c9785f" opacity=".6" />
      <path d="M362 214l18 40" stroke={SHIRT_BACK} strokeWidth="10" strokeLinecap="round" />
      <g {...anim('puff', { '--a': '-92deg', '--d': '5s' }, '380px 254px')}>
        <path d="M380 254l44 12" stroke={C.skin} strokeWidth="9" strokeLinecap="round" />
        <path d="M424 266l24 8m-2-6 6 2" stroke="#8d8f84" strokeWidth="3" strokeLinecap="round" />
      </g>
    </>
  )
}

export function MusicScene({ uid }: { uid: string }) {
  const note = (delay: string, x: string) => (
    <g {...anim('rise', { '--d': '4.5s', '--x': x, '--y': '-110px' }, undefined, delay)}>
      <ellipse cx="560" cy="226" rx="7" ry="5" fill="#6d7f6c" transform="rotate(-20 560 226)" />
      <path d="M566 224v-26l10 4" stroke="#6d7f6c" strokeWidth="3" fill="none" />
    </g>
  )
  return (
    <>
      <Room uid={uid} />
      <ArchedWindow uid={uid} x={620} y={46} w={200} h={200} />
      <rect x="120" y="70" width="110" height="140" rx="3" fill="#b58f73" />
      <circle cx="175" cy="126" r="34" fill="#e2d6b8" />
      <circle cx="175" cy="126" r="8" fill="#b58f73" />
      <path d="M130 190h90" stroke="#e2d6b8" strokeWidth="6" />
      <g>
        <rect x="190" y="252" width="110" height="92" rx="8" fill="#55594f" />
        <circle cx="245" cy="302" r="30" fill="#3f4238" />
        <circle cx="245" cy="302" r="10" fill="#55594f" />
        <circle {...anim('glow', { '--d': '1.4s', '--from': '.3' })} cx="284" cy="264" r="4" fill="#e8784f" />
      </g>
      <ellipse cx="470" cy="378" rx="190" ry="22" fill="#b6ad96" opacity=".45" />
      <path d="M400 300l-10 68m60-68 10 68m-64-30h58" stroke={C.woodDark} strokeWidth="7" />
      <rect x="386" y="290" width="76" height="12" rx="5" fill={C.wood} />
      <g {...anim('breathe')}>
        <g {...anim('swing', { '--a': '3deg', '--d': '.9s' }, '430px 200px')}>
          <path d="M424 188h14v16h-14z" fill={C.skinShade} />
          <Head x={432} y={176} r={21} facing="right" />
        </g>
        <path d="M430 292h48v62" stroke={C.pants} strokeWidth="15" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M410 298q-6-72 12-90q18-6 28 6l6 84z" fill="#6d8b88" />
        <path d="M444 216l40 18 58-16" stroke={C.skinShade} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <g transform="rotate(-24 470 272)">
          <ellipse cx="455" cy="272" rx="26" ry="24" fill="#b27b52" />
          <ellipse cx="486" cy="272" rx="20" ry="18" fill="#b27b52" />
          <circle cx="474" cy="272" r="7" fill="#5a4636" />
          <rect x="500" y="268" width="80" height="8" rx="2" fill="#6b5240" />
          <rect x="578" y="265" width="18" height="14" rx="3" fill="#5a4636" />
        </g>
        <path d="M432 222l6 38" stroke={C.shirt} strokeWidth="11" strokeLinecap="round" />
        <g {...anim('swing', { '--a': '12deg', '--d': '.35s' }, '438px 260px')}>
          <path d="M438 260l28 6" stroke={C.skin} strokeWidth="9" strokeLinecap="round" />
        </g>
      </g>
      {note('0s', '10px')}
      {note('-1.5s', '28px')}
      {note('-3s', '-6px')}
    </>
  )
}

/** Multiple monitors with charts that keep moving. */
export function TradingScene({ uid }: { uid: string }) {
  const candles = Array.from({ length: 30 }, (_, i) => {
    const up = [1, 1, 0, 1, 0, 0, 1, 1, 0, 1][i % 10] === 1
    const h = [14, 22, 10, 18, 26, 12, 20, 16, 24, 11][i % 10]
    const y = [30, 22, 28, 18, 24, 34, 20, 26, 16, 30][i % 10]
    return { x: i * 12, up, h, y }
  })
  return (
    <>
      <Room uid={uid} />
      <ArchedWindow uid={uid} x={104} y={46} />
      <defs>
        <clipPath id={`${uid}-screen-a`}><rect x="552" y="140" width="96" height="72" /></clipPath>
        <clipPath id={`${uid}-screen-b`}><rect x="662" y="140" width="96" height="72" /></clipPath>
      </defs>
      <path d="M430 294v82m103-82v82" stroke="#696c5b" strokeWidth="10" />
      <rect x="416" y="226" width="111" height="79" rx="23" fill="#829082" />
      <g {...anim('breathe')}>
        <path d="M455 279q-10-63 28-67 36 0 40 67" fill="#6d8b88" />
        <path d="M474 216v-18h23v19" fill={C.skinShade} />
        <Head x={488} y={177} r={27} facing="right" />
        <path d="m505 239 28 29 47 2" fill="none" stroke={C.skin} strokeWidth="14" strokeLinecap="round" />
      </g>
      <path d="M368 291v102m360-102v102" stroke={C.woodDark} strokeWidth="12" />
      <rect x="351" y="278" width="392" height="17" rx="5" fill={C.wood} />
      {[
        { x: 546, clip: 'a' },
        { x: 656, clip: 'b' },
      ].map(({ x, clip }) => (
        <g key={clip}>
          <rect x={x} y="134" width="108" height="84" rx="4" fill="#3f4238" />
          <rect x={x + 6} y="140" width="96" height="72" fill="#2f3a36" />
          <path d={`M${x + 50} 218v40m-20 0h40`} stroke={C.metal} strokeWidth="6" />
        </g>
      ))}
      <g clipPath={`url(#${uid}-screen-a)`}>
        <g {...anim('slide', { '--x': '-120px', '--d': '9s' })}>
          {candles.map(({ x, up, h, y }) => (
            <g key={x}>
              <path d={`M${556 + x} ${140 + y - 5}v${h + 10}`} stroke={up ? C.up : C.down} strokeWidth="1.5" />
              <rect x={553 + x} y={140 + y} width="6" height={h} fill={up ? C.up : C.down} />
            </g>
          ))}
        </g>
      </g>
      <g clipPath={`url(#${uid}-screen-b)`}>
        <g {...anim('slide', { '--x': '-120px', '--d': '7s' })}>
          <path
            d={`M662 190${Array.from({ length: 3 }, () => 'l12-8 12 6 12-14 12 4 12-10 12 12 12-6 12 16').join('')}`}
            fill="none"
            stroke={C.up}
            strokeWidth="2.5"
          />
        </g>
        <rect {...anim('cursor')} x="742" y="146" width="10" height="4" fill={C.up} />
      </g>
      <rect x="600" y="266" width="20" height="10" rx="2" fill="#3f4238" />
      <rect {...anim('glow', { '--d': '2s', '--from': '.2' })} x="602" y="268" width="16" height="6" fill="#dfe9e3" />
      <Mug x={394} y={252} />
    </>
  )
}

/** A grand study hall: arched windows, banker's lamps, long table. Library or the CAA. */
export function LibraryScene({ uid }: { uid: string }) {
  const arch = (x: number) => `M${x} 300V110Q${x} 60 ${x + 70} 40Q${x + 140} 60 ${x + 140} 110V300z`
  const bookColors = ['#8a5a44', '#5e7560', '#a4885c', '#6c6e8a', '#9b6b4f', '#5a6b58', '#b09a6c']
  return (
    <>
      <Room uid={uid} wall={['#e6ddc9', '#d8ceb8']} floor="#a58d6e" />
      <path d="M0 246h900v92H0z" fill="#8a7156" />
      <path d="M0 246h900v8H0z" fill="#6f5a43" />
      <defs>
        <linearGradient id={`${uid}-lib-sky`} x2="0" y2="1">
          <stop stopColor="#b7cbc6" />
          <stop offset="1" stopColor="#efe4c8" />
        </linearGradient>
      </defs>
      {[60, 700].map(x => (
        <g key={x}>
          <path d={arch(x)} fill={`url(#${uid}-lib-sky)`} stroke="#6f5a43" strokeWidth="10" strokeLinejoin="round" />
          <path d={`M${x + 70} 42v258M${x} 170h140M${x} 235h140`} stroke="#6f5a43" strokeWidth="5" />
          <path d={`M${x + 30} 110q40-40 80 0`} stroke="#6f5a43" strokeWidth="3" fill="none" />
        </g>
      ))}
      <path d="M130 300 330 440H20z" fill={C.glow} opacity=".18" />
      <path d="M770 300 880 440H640z" fill={C.glow} opacity=".18" />
      <g fill="#e9dcb4">
        {[
          [150, '-0s', '14px'], [190, '-3s', '-10px'], [230, '-6s', '6px'], [720, '-2s', '-8px'], [770, '-5s', '12px'],
        ].map(([x, delay, dx]) => (
          <circle key={x as number} {...anim('rise', { '--d': '9s', '--x': dx as string, '--y': '-90px' }, undefined, delay as string)} cx={x as number} cy="380" r="2" />
        ))}
      </g>
      <g>
        <rect x="250" y="56" width="400" height="186" fill="#6f5a43" />
        {[0, 1, 2, 3].map(row => (
          <g key={row}>
            {Array.from({ length: 26 }, (_, i) => (
              <rect
                key={i}
                x={258 + i * 15}
                y={64 + row * 45 + (i % 3) * 3}
                width={12}
                height={36 - (i % 3) * 3}
                fill={bookColors[(i + row * 3) % bookColors.length]}
              />
            ))}
            <path d={`M250 ${102 + row * 45}h400`} stroke="#5a4636" strokeWidth="6" />
          </g>
        ))}
      </g>
      <g {...anim('breathe')}>
        <path d="M432 300q-6-60 38-66 44 6 38 66z" fill="#6d7f6c" />
        <path d="M463 216h14v20h-14z" fill={C.skinShade} />
        <g transform="rotate(8 470 200)">
          <Head x={470} y={200} r={22} />
        </g>
        <path d="M442 250l-14 44 40 6" stroke="#6d7f6c" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <g {...anim('swing', { '--a': '4deg', '--d': '1.3s' }, '500px 250px')}>
          <path d="M500 250l12 44-26 6" stroke="#6d7f6c" strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M486 300l-10-10" stroke="#3f4238" strokeWidth="3" />
        </g>
      </g>
      <path d="M280 310v70m380-70v70" stroke="#5a4636" strokeWidth="12" />
      <rect x="240" y="298" width="460" height="16" rx="4" fill="#7a5f45" />
      <path d="M430 298l40-10 40 10-40 4z" fill={C.paper} />
      <path d="M470 288v12" stroke="#c9bb98" strokeWidth="2" />
      {[330, 610].map(x => (
        <g key={x}>
          <LampGlow uid={uid} id={`lamp-${x}`} cx={x} cy={284} rx={56} ry={30} />
          <path d={`M${x} 298v-26`} stroke="#b89b5e" strokeWidth="4" />
          <path d={`M${x - 26} 276q26-22 52 0z`} fill="#3f6b52" />
          <ellipse cx={x} cy="298" rx="12" ry="3" fill="#b89b5e" />
        </g>
      ))}
      <g>
        <rect x="560" y="284" width="46" height="8" fill="#8a5a44" />
        <rect x="564" y="276" width="40" height="8" fill="#5e7560" />
        <rect x="558" y="268" width="44" height="8" fill="#a4885c" />
      </g>
    </>
  )
}

/** A quiet bathroom: a dripping tap, steam from the bath, no one in view. */
export function BathroomScene({ uid }: { uid: string }) {
  return (
    <>
      <Room uid={uid} wall={['#e8ece8', '#dde3de']} floor="#c9c4b6" />
      <defs>
        <pattern id={`${uid}-tile`} width="36" height="36" patternUnits="userSpaceOnUse">
          <rect width="36" height="36" fill="#d9e3dd" />
          <path d="M0 0h36v36" fill="none" stroke="#c4d0c9" strokeWidth="2" />
        </pattern>
      </defs>
      <rect x="0" y="150" width="900" height="188" fill={`url(#${uid}-tile)`} />
      <path d="M0 150h900" stroke="#c4d0c9" strokeWidth="5" />
      <rect x="380" y="40" width="80" height="60" rx="6" fill={C.cream} />
      <rect x="386" y="46" width="68" height="48" rx="3" fill={C.sky} opacity=".7" />
      <path d="M60 60h330" stroke="#a6a79c" strokeWidth="5" strokeLinecap="round" />
      <g {...anim('swing', { '--a': '1deg', '--d': '5s' }, '110px 60px')}>
        <path d="M70 62h90l-8 260q-40 8-76 0z" fill="#b9c8c4" />
        <path d="M90 64l-4 256m26-256v258m26-258 4 256" stroke="#a5b6b1" strokeWidth="3" />
      </g>
      <path d="M150 262h250q10 0 8 12l-12 52q-4 12-16 12H172q-12 0-16-12l-12-52q-2-12 6-12z" fill="#f7f4ec" />
      <path d="M170 338l-6 14m220-14 6 14" stroke="#a6a79c" strokeWidth="6" strokeLinecap="round" />
      <g fill="none" stroke={C.steam} strokeWidth="4" strokeLinecap="round">
        <path {...anim('rise', { '--d': '6s', '--x': '10px', '--y': '-120px' })} d="M230 256q-8-10 0-20t0-18" />
        <path {...anim('rise', { '--d': '6s', '--x': '-8px', '--y': '-110px' }, undefined, '-2s')} d="M290 256q8-10 0-20t0-18" />
        <path {...anim('rise', { '--d': '6s', '--x': '14px', '--y': '-130px' }, undefined, '-4s')} d="M350 256q-8-10 0-20t0-18" />
      </g>
      <ellipse cx="610" cy="150" rx="66" ry="80" fill="#b8a07d" />
      <ellipse cx="610" cy="150" rx="56" ry="70" fill="#dfe8e6" />
      <ellipse {...anim('glow', { '--d': '6s', '--from': '.1', '--to': '.6' })} cx="600" cy="140" rx="40" ry="52" fill="#f4f7f5" />
      <path d="M580 110l30-20m-20 50 40-30" stroke="#f7faf8" strokeWidth="6" strokeLinecap="round" opacity=".7" />
      <rect x="520" y="262" width="180" height="76" rx="6" fill={C.wood} />
      <path d="M610 272v56" stroke={C.woodDark} strokeWidth="3" />
      <circle cx="596" cy="300" r="4" fill={C.woodDark} />
      <circle cx="624" cy="300" r="4" fill={C.woodDark} />
      <path d="M512 250h196v14H512z" fill="#f7f4ec" />
      <ellipse cx="610" cy="252" rx="54" ry="7" fill="#e3e0d6" />
      <path d="M610 250v-22q0-12 14-12t14 12" stroke="#a6a79c" strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse {...anim('drip', { '--d': '3.2s', '--y': '14px' })} cx="638" cy="236" rx="2.5" ry="3.5" fill="#9fc0c6" />
      <g transform="translate(672 232) scale(.45)">
        <path d="m0 0 58 0-9 60h-40z" fill="#b98d73" />
        <path d="M27 0q-8-60 13-90m-12 60q-40-15-30-40 28 3 30 40m5-30q5-40 32-36 1 26-32 36" fill={C.leaf} stroke={C.leaf} strokeWidth="4" />
      </g>
      <path d="M760 190h100" stroke="#a6a79c" strokeWidth="5" strokeLinecap="round" />
      <g {...anim('swing', { '--a': '.8deg', '--d': '6s' }, '810px 190px')}>
        <path d="M772 190h76v120q-38 8-76 0z" fill="#c9785f" opacity=".85" />
        <path d="M772 290h76" stroke="#f0dfbc" strokeWidth="5" />
      </g>
      <rect x="720" y="318" width="120" height="16" rx="6" fill="#9fb0a5" />
    </>
  )
}

/** A waiting room: a ticking clock, a water cooler, a clipboard. */
export function DoctorScene({ uid }: { uid: string }) {
  return (
    <>
      <Room uid={uid} wall={['#e2ebe7', '#d2ddd8']} floor="#c4c5b8" />
      <path d="M0 250h900" stroke="#c3d0ca" strokeWidth="6" />
      <g>
        <circle cx="450" cy="92" r="36" fill="#f7f7f2" stroke="#8d8f84" strokeWidth="5" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M450 62v6" stroke="#8d8f84" strokeWidth="2" transform={`rotate(${i * 30} 450 92)`} />
        ))}
        <path d="M450 92l14-10" stroke={C.shoe} strokeWidth="4" strokeLinecap="round" />
        <g {...anim('turn', { '--d': '60s' }, '450px 92px')}>
          <path d="M450 92V66" stroke={C.shoe} strokeWidth="3" strokeLinecap="round" />
        </g>
        <g {...anim('turn', { '--d': '6s' }, '450px 92px')}>
          <path d="M450 98V62" stroke={C.down} strokeWidth="1.5" />
        </g>
        <circle cx="450" cy="92" r="3" fill={C.shoe} />
      </g>
      <rect x="220" y="84" width="90" height="112" rx="3" fill="#f7f7f2" stroke="#b8c4be" strokeWidth="4" />
      <path d="M265 118q-14-14-24 0 0 14 24 30 24-16 24-30-10-14-24 0z" fill="#d99585" />
      <path d="M238 166h54m-54 12h40" stroke="#b8c4be" strokeWidth="4" />
      <g>
        <rect x="620" y="96" width="250" height="130" rx="6" fill="#b8c4be" />
        <rect x="632" y="108" width="226" height="106" fill="#e9f1ee" opacity=".8" />
        <path d="M745 108v106" stroke="#b8c4be" strokeWidth="4" />
        <rect x="604" y="226" width="282" height="112" fill="#a9b8b1" />
        <rect x="596" y="220" width="298" height="12" rx="3" fill="#8fa39a" />
        <rect x="660" y="206" width="36" height="14" rx="2" fill="#f7f7f2" />
      </g>
      <g>
        <rect x="532" y="250" width="44" height="88" rx="4" fill="#dfe3dc" />
        <path d="M536 250q-6-44 18-60h0q24 16 18 60z" fill="#a9cbd3" opacity=".75" />
        <rect x="548" y="276" width="10" height="8" rx="2" fill="#8d8f84" />
        {['0s', '-1.2s', '-2.4s'].map((delay, i) => (
          <circle key={delay} {...anim('rise', { '--d': '3.6s', '--x': `${i * 3 - 3}px`, '--y': '-40px' }, undefined, delay)} cx={550 + i * 5} cy="244" r="3" fill="#e9f5f7" />
        ))}
      </g>
      {[120, 230, 340].map(x => (
        <g key={x}>
          <rect x={x} y="220" width="90" height="70" rx="12" fill="#7f9a9a" />
          <rect x={x - 4} y="282" width="98" height="18" rx="6" fill="#6c8686" />
          <path d={`M${x + 8} 300v38m74-38v38`} stroke="#6c7370" strokeWidth="6" />
        </g>
      ))}
      <g {...anim('breathe')}>
        <path d="M258 290v48m24-48v48" stroke={C.pants} strokeWidth="15" strokeLinecap="round" />
        <path d="M250 292q-4-60 20-66 24 6 20 66z" fill={C.shirt} />
        <path d="M263 212h14v18h-14z" fill={C.skinShade} />
        <g {...anim('swing', { '--a': '2deg', '--d': '3s' }, '270px 220px')}>
          <Head x={270} y={196} r={21} />
        </g>
        <rect x="252" y="262" width="36" height="30" rx="2" fill={C.cream} transform="rotate(-6 270 276)" />
        <rect x="262" y="258" width="16" height="6" rx="2" fill="#8d8f84" />
        <path d="M252 244l6 34m34-34-6 34" stroke={C.skin} strokeWidth="9" strokeLinecap="round" />
      </g>
      <Plant x={40} y={280} s={0.9} />
    </>
  )
}

/** At the easel: a brush that keeps working, dabs of paint that come and go on the canvas. */
export function ArtScene({ uid }: { uid: string }) {
  const dabs: [number, number, string, string][] = [
    [560, 120, '#c9785f', '0s'], [600, 150, '#6d8b88', '-1s'], [540, 170, '#d4b77d', '-2s'],
    [620, 110, '#8a9c6a', '-3s'], [585, 195, '#b27b52', '-1.5s'],
  ]
  return (
    <>
      <Room uid={uid} />
      <ArchedWindow uid={uid} x={96} y={46} w={200} h={200} />
      <path fill={C.glow} opacity=".2" d="m110 260 180-6 200 180H230z" />
      <rect x="690" y="70" width="90" height="70" rx="3" fill="#b58f73" />
      <rect x="698" y="78" width="74" height="54" fill="#e2d6b8" />
      <path d="M704 124q16-30 30-10t32-14" stroke="#6d8b88" strokeWidth="4" fill="none" />
      <circle cx="754" cy="94" r="7" fill="#d4b77d" />
      <path d="M530 360l50-280m60 280-50-280m-10 60v300" stroke={C.woodDark} strokeWidth="9" strokeLinecap="round" />
      <rect x="512" y="92" width="150" height="128" rx="3" fill={C.paper} stroke="#b8a682" strokeWidth="4" />
      <path d="M526 200q30-40 60-18t62-26" stroke="#94b5b1" strokeWidth="10" fill="none" opacity=".6" strokeLinecap="round" />
      {dabs.map(([x, y, fill, delay]) => (
        <ellipse key={x} {...anim('glow', { '--d': '4s', '--from': '.15', '--to': '.9' }, undefined, delay)} cx={x} cy={y} rx="14" ry="9" fill={fill} />
      ))}
      <rect x="500" y="220" width="174" height="10" rx="3" fill={C.wood} />
      <g {...anim('breathe')}>
        <path d="M398 340v-62m28 62v-62" stroke={C.pants} strokeWidth="16" strokeLinecap="round" />
        <path d="M390 282q-8-80 24-90 34 8 26 90z" fill="#6d8b88" />
        <path d="M408 186h16v18h-16z" fill={C.skinShade} />
        <Head x={418} y={164} r={23} facing="right" />
        <path d="M398 214l-26 44 18 6" stroke={C.skin} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx="384" cy="266" rx="26" ry="14" fill="#c9a77f" transform="rotate(-14 384 266)" />
        {['#c9785f', '#6d8b88', '#d4b77d'].map((fill, i) => <circle key={fill} cx={372 + i * 11} cy={262 + (i % 2) * 4} r="4" fill={fill} />)}
        <g {...anim('swing', { '--a': '8deg', '--d': '1.1s' }, '432px 212px')}>
          <path d="M432 212l40 4 34-30" stroke={C.skin} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M504 188l24-20" stroke={C.woodDark} strokeWidth="3" strokeLinecap="round" />
          <circle cx="529" cy="167" r="3" fill="#c9785f" />
        </g>
      </g>
      <Plant x={790} y={278} s={0.9} />
    </>
  )
}
