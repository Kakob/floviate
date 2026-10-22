import { C, Hills, OutdoorSky, Scroll, Tree, anim, Head } from './primitives'

const PANTS_BACK = '#4f5a4f'
const SHIRT_BACK = '#96614c'
const GRASS = '#9fae8c'
const PATH = '#d8ccb0'

/** A person walking in profile, facing right, feet on y=372. Speed and stride are parameters. */
function Strider({ d, stride, arm, lean = 0, bentArms = false }: { d: string; stride: string; arm: string; lean?: number; bentArms?: boolean }) {
  const legBack = anim('swing', { '--a': stride, '--d': d }, '450px 290px', `-${d}`)
  const legFront = anim('swing', { '--a': stride, '--d': d }, '450px 290px')
  const armBack = anim('swing', { '--a': arm, '--d': d }, '452px 220px')
  const armFront = anim('swing', { '--a': arm, '--d': d }, '452px 220px', `-${d}`)
  const armPath = bentArms ? 'M452 220l-4 30 20 14' : 'M452 220v52'
  return (
    <g transform={`rotate(${lean} 450 372)`}>
      <g {...anim('bob', { '--y': '-3px', '--d': d })}>
        <g {...armBack}>
          <path d={armPath} stroke={SHIRT_BACK} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <g {...legBack}>
          <path d="M450 290v78" stroke={PANTS_BACK} strokeWidth="15" strokeLinecap="round" />
          <path d="M448 371h18" stroke={C.shoe} strokeWidth="8" strokeLinecap="round" />
        </g>
        <path d="M436 212q15-10 31 0l4 82h-39z" fill={C.shirt} />
        <g {...legFront}>
          <path d="M450 290v78" stroke={C.pants} strokeWidth="15" strokeLinecap="round" />
          <path d="M448 371h18" stroke={C.shoe} strokeWidth="8" strokeLinecap="round" />
        </g>
        <g {...armFront}>
          <path d={armPath} stroke={C.shirt} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx={bentArms ? 468 : 452} cy={bentArms ? 264 : 274} r="6" fill={C.skin} />
        </g>
        <path d="M446 196h13v16h-13z" fill={C.skinShade} />
        <Head x={455} y={182} r={19} facing="right" />
      </g>
    </g>
  )
}

export function WalkingScene({ uid }: { uid: string }) {
  return (
    <>
      <OutdoorSky uid={uid} />
      <Scroll d="120s"><Hills y={220} /></Scroll>
      <path d="M0 330h900v110H0z" fill={GRASS} />
      <Scroll d="36s">
        <Tree x={90} ground={334} s={1.1} />
        <Tree x={330} ground={332} s={0.9} tone="#728b6e" />
        <Tree x={560} ground={334} s={1.2} />
        <Tree x={790} ground={333} s={0.95} tone="#728b6e" />
        <path d="M210 334v-46m-8 0h16" stroke={C.woodDark} strokeWidth="5" />
        <rect x="660" y="312" width="70" height="8" rx="3" fill={C.wood} />
        <path d="M668 320v14m54-14v14" stroke={C.woodDark} strokeWidth="5" />
      </Scroll>
      <path d="M0 356h900v44H0z" fill={PATH} />
      <Scroll d="12s">
        {[40, 170, 290, 430, 560, 700, 820].map(x => (
          <ellipse key={x} cx={x} cy={392} rx="9" ry="3" fill="#c2b597" />
        ))}
      </Scroll>
      <Strider d=".6s" stride="20deg" arm="16deg" />
      <Scroll d="7s">
        {[60, 240, 410, 600, 770].map(x => (
          <path key={x} d={`M${x} 440q4-24 8-30m4 30q2-20 9-26m3 26q-2-16 6-22`} stroke="#7f9570" strokeWidth="4" fill="none" />
        ))}
      </Scroll>
    </>
  )
}

/** Running along the lakefront. */
export function RunningScene({ uid }: { uid: string }) {
  return (
    <>
      <OutdoorSky uid={uid} top="#9fbfc4" bottom="#efe1c4" />
      <g fill="#a7b3b4" opacity=".7">
        <path d="M60 250v-60h26v60zm34 0v-92h20v92zm28 0v-44h30v44zm40 0v-118h16v118zm26 0v-70h24v70z" />
        <path d="M178 132v-18h4v18z" />
      </g>
      <path d="M0 246h900v52H0z" fill="#7fa5a6" />
      <g fill="#dfe9e3">
        <rect {...anim('glow', { '--d': '2.6s', '--from': '0' })} x="300" y="262" width="60" height="3" rx="1.5" />
        <rect {...anim('glow', { '--d': '3.4s', '--from': '0' })} x="560" y="276" width="90" height="3" rx="1.5" />
        <rect {...anim('glow', { '--d': '2.1s', '--from': '0' })} x="760" y="258" width="40" height="3" rx="1.5" />
      </g>
      <path d="M0 296h900v8H0z" fill="#b9b19a" />
      <path d="M0 304h900v136H0z" fill={GRASS} />
      <Scroll d="14s">
        <Tree x={120} ground={336} s={0.8} />
        <Tree x={480} ground={336} s={0.95} tone="#728b6e" />
        <Tree x={780} ground={336} s={0.85} />
      </Scroll>
      <path d="M0 356h900v44H0z" fill={PATH} />
      <Scroll d="4s">
        {[0, 150, 300, 450, 600, 750].map(x => (
          <path key={x} d={`M${x} 378h60`} stroke="#eee4cc" strokeWidth="4" strokeLinecap="round" />
        ))}
      </Scroll>
      <Strider d=".32s" stride="34deg" arm="38deg" lean={9} bentArms />
      <Scroll d="3s">
        {[60, 280, 520, 740].map(x => (
          <path key={x} d={`M${x} 440q4-24 8-30m4 30q2-20 9-26`} stroke="#7f9570" strokeWidth="4" fill="none" />
        ))}
      </Scroll>
    </>
  )
}

export function BikingScene({ uid }: { uid: string }) {
  const wheel = (cx: number) => (
    <g>
      <circle cx={cx} cy="372" r="42" fill="none" stroke={C.shoe} strokeWidth="6" />
      <g {...anim('spin', { '--d': '.7s' })}>
        <circle cx={cx} cy="372" r="42" fill="none" stroke="none" />
        <path d={`M${cx - 38} 372h76M${cx} 334v76M${cx - 27} 345l54 54M${cx + 27} 345l-54 54`} stroke="#8d8f84" strokeWidth="2" />
      </g>
      <circle cx={cx} cy="372" r="5" fill={C.metal} />
    </g>
  )
  return (
    <>
      <OutdoorSky uid={uid} />
      <Scroll d="100s"><Hills y={230} /></Scroll>
      <path d="M0 320h900v120H0z" fill={GRASS} />
      <Scroll d="14s">
        <Tree x={60} ground={322} s={1} />
        <Tree x={280} ground={322} s={1.15} tone="#728b6e" />
        <path d="M420 322v-120m0 0q18 0 26 12" stroke={C.metal} strokeWidth="5" fill="none" />
        <circle cx="446" cy="216" r="6" fill={C.lamp} />
        <Tree x={600} ground={322} s={0.9} />
        <Tree x={800} ground={322} s={1.05} tone="#728b6e" />
      </Scroll>
      <path d="M0 412h900v28H0z" fill="#a6a391" />
      <path d="M0 404h900v10H0z" fill={PATH} />
      <Scroll d="3s">
        {[0, 180, 360, 540, 720].map(x => (
          <path key={x} d={`M${x} 426h70`} stroke="#d8d2bc" strokeWidth="4" strokeLinecap="round" />
        ))}
      </Scroll>
      <g {...anim('bob', { '--y': '-1.5px', '--d': '.35s' })}>
        {wheel(380)}
        {wheel(535)}
        <path d="M380 372l65 0 60-62H425l20 62m-20-62-45 62m125-62 30 62m-35-72 8 10m-12-10h22" stroke="#6d8b88" strokeWidth="7" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M414 296h28" stroke={C.shoe} strokeWidth="7" strokeLinecap="round" />
        <g {...anim('turn', { '--d': '.9s' }, '445px 372px')}>
          <circle cx="445" cy="372" r="11" fill="none" stroke={C.metal} strokeWidth="4" />
          <path d="M445 352v40m-8-40h16m-16 40h16" stroke={C.shoe} strokeWidth="5" strokeLinecap="round" />
        </g>
        <g {...anim('swing', { '--a': '16deg', '--d': '.45s' }, '430px 292px', '-.45s')}>
          <path d="M430 292l38 38-18 40" stroke={PANTS_BACK} strokeWidth="13" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <path d="M428 290l52-58" stroke={C.shirt} strokeWidth="30" strokeLinecap="round" />
        <g {...anim('swing', { '--a': '16deg', '--d': '.45s' }, '430px 292px')}>
          <path d="M430 292l38 38-18 40" stroke={C.pants} strokeWidth="13" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <path d="M480 236l30 58" stroke={C.skin} strokeWidth="10" strokeLinecap="round" />
        <Head x={496} y={210} r={18} facing="right" />
        <path d="M478 200q18-26 38-4z" fill="#6d8b88" />
      </g>
    </>
  )
}

export function DrivingScene({ uid }: { uid: string }) {
  const wheel = (cx: number) => (
    <g>
      <circle cx={cx} cy="382" r="30" fill={C.shoe} />
      <g {...anim('spin', { '--d': '.45s' })}>
        <circle cx={cx} cy="382" r="15" fill="#a6a79c" />
        <path d={`M${cx - 15} 382h30M${cx} 367v30`} stroke={C.metal} strokeWidth="3" />
      </g>
    </g>
  )
  return (
    <>
      <OutdoorSky uid={uid} top="#a6bdc0" bottom="#ece0c6" />
      <Scroll d="90s"><Hills y={236} /></Scroll>
      <Scroll d="9s">
        <g fill="#b5ae9b">
          <path d="M40 330v-80h70v80zm90 0v-110h50v110zm230 0v-60h80v60zm230 0v-96h60v96z" />
        </g>
        <g fill={C.cream} opacity=".7">
          <path d="M52 262h12v10H52zm28 0h12v10H80zm-28 24h12v10H52zm90-54h10v10h-10zm0 28h10v10h-10zm472-6h12v10h-12zm0 26h12v10h-12z" />
        </g>
        <Tree x={260} ground={332} s={0.9} />
        <Tree x={500} ground={332} s={1.05} tone="#728b6e" />
        <Tree x={820} ground={332} s={0.95} />
      </Scroll>
      <path d="M0 330h900v14H0z" fill={GRASS} />
      <path d="M0 344h900v96H0z" fill="#7a7b72" />
      <Scroll d="1.4s">
        {[0, 150, 300, 450, 600, 750].map(x => (
          <path key={x} d={`M${x} 420h70`} stroke="#e6dcc0" strokeWidth="5" />
        ))}
      </Scroll>
      <g {...anim('bob', { '--y': '-2px', '--d': '.5s' })}>
        <path d="M290 388q-6-34 26-44l68-10q34-46 84-50h92q46 4 80 50l52 8q34 6 36 34v12z" fill="#7f9a9a" />
        <path d="M398 332q30-38 66-40h36v40zm110 0v-40h36q34 4 58 40z" fill="#c4d5d0" />
        <path d="M290 372h438" stroke="#6c8686" strokeWidth="4" />
        <Head x={528} y={312} r={15} facing="right" />
        <path d="M548 324q10 0 12 8" stroke={C.shoe} strokeWidth="4" fill="none" />
        <ellipse {...anim('glow', { '--d': '1.6s', '--from': '.6' })} cx="724" cy="356" rx="7" ry="5" fill="#f8e5b0" />
        <rect x="292" y="350" width="10" height="8" rx="2" fill={C.down} />
      </g>
      {wheel(380)}
      {wheel(640)}
    </>
  )
}

/** A balcony at dusk, with the city lighting up. */
export function SmokingScene({ uid }: { uid: string }) {
  const windows = [
    [96, 214, '2.8s'], [124, 236, '3.6s'], [212, 190, '4.4s'], [236, 222, '3.1s'], [562, 206, '2.4s'],
    [590, 238, '4.9s'], [700, 226, '3.9s'], [760, 196, '2.9s'], [788, 248, '4.2s'],
  ] as const
  return (
    <>
      <OutdoorSky uid={uid} top="#8e9bb5" bottom="#ecc9a4" sun="#f2c48d" />
      <g fill="#6f7589">
        <path d="M70 300V200h80v100zm120 0V172h66v128zm290 0v-70h54v70zm70 0V180h70v120zm120 0v-104h64v104zm70 0v-60h60v60z" />
      </g>
      <g fill="#f5d99b">
        {windows.map(([x, y, d]) => (
          <rect key={`${x}-${y}`} {...anim('glow', { '--d': d, '--from': '.15' })} x={x} y={y} width="10" height="12" />
        ))}
      </g>
      <path d="M0 300h900v140H0z" fill="#aaa294" />
      <path d="M0 360h900v80H0z" fill="#b9b2a2" />
      <path d="M0 262h900v10H0z" fill="#6c665b" />
      <path d="M0 272h900" stroke="#6c665b" strokeWidth="2" />
      <g stroke="#6c665b" strokeWidth="4">
        {Array.from({ length: 30 }, (_, i) => (
          <path key={i} d={`M${i * 30 + 15} 272v88`} />
        ))}
      </g>
      <path d="M640 360v-60h56v60m-56-30h56" stroke={C.woodDark} strokeWidth="6" fill="none" />
      <rect x="628" y="300" width="80" height="10" rx="3" fill={C.wood} />
      <g transform="translate(740 312) scale(.75)">
        <path d="m0 0 58 0-9 60h-40z" fill="#b98d73" />
        <path d="M27 0q-8-60 13-90m-12 60q-40-15-30-40 28 3 30 40m5-30q5-40 32-36 1 26-32 36" fill={C.leaf} stroke={C.leaf} strokeWidth="4" />
      </g>
      <g {...anim('breathe')}>
        <path d="M322 294v70m18-70v70" stroke={C.pants} strokeWidth="15" strokeLinecap="round" />
        <path d="M314 208q16-10 34 0l6 92h-44z" fill={C.shirt} />
        <path d="M325 192h14v18h-14z" fill={C.skinShade} />
        <Head x={336} y={178} r={20} facing="right" />
        <path d="M344 216l6 36" stroke={C.shirt} strokeWidth="11" strokeLinecap="round" />
        <g {...anim('puff', { '--a': '-74deg', '--d': '9s' }, '350px 252px')}>
          <path d="M350 252h42" stroke={C.skin} strokeWidth="9" strokeLinecap="round" />
          <path d="M396 250h14" stroke={C.cream} strokeWidth="3" />
          <circle {...anim('glow', { '--d': '1.2s', '--from': '.4' })} cx="411" cy="250" r="2.5" fill="#e8784f" />
        </g>
      </g>
      <g fill="none" stroke="#f2ede3" strokeWidth="3" strokeLinecap="round">
        <path {...anim('rise', { '--d': '5s', '--x': '18px', '--y': '-80px' })} d="M412 244q-6-8 0-16t0-14" />
        <path {...anim('rise', { '--d': '5s', '--x': '26px', '--y': '-90px' }, undefined, '-1.7s')} d="M412 244q6-8 0-16t0-14" />
        <path {...anim('rise', { '--d': '5s', '--x': '12px', '--y': '-70px' }, undefined, '-3.4s')} d="M412 244q-5-7 0-13" />
      </g>
    </>
  )
}
