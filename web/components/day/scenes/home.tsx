import { styles } from './primitives'

/** The original home room: a desk (writing, computer) or an armchair (reading, quiet). */
export function HomeScene({ uid, variant }: { uid: string; variant: 'writing' | 'computer' | 'reading' | 'quiet' }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-wall`} x2="0" y2="1"><stop stopColor="#ece7da"/><stop offset="1" stopColor="#dcd7c9"/></linearGradient>
        <linearGradient id={`${uid}-sky`} x2="0" y2="1"><stop stopColor="#94b5b1"/><stop offset="1" stopColor="#e5dac0"/></linearGradient>
        <radialGradient id={`${uid}-light`}><stop stopColor="#fff4bf" stopOpacity=".8"/><stop offset="1" stopColor="#fff4bf" stopOpacity="0"/></radialGradient>
        <clipPath id={`${uid}-window`}><rect x="104" y="46" width="234" height="222" rx="100"/></clipPath>
      </defs>
      <path fill={`url(#${uid}-wall)`} d="M0 0h900v440H0z"/>
      <path fill="#c4beaa" d="M0 338h900v102H0z"/>
      <path fill="#d5cebb" d="M0 338h900v7H0z"/>
      <path fill="#f5e8bc" opacity=".32" d="m119 268 214-10 227 180H246z"/>
      <rect x="94" y="36" width="254" height="244" rx="111" fill="#f5f0e3"/>
      <g clipPath={`url(#${uid}-window)`}>
        <rect x="104" y="46" width="234" height="222" fill={`url(#${uid}-sky)`}/>
        <circle cx="275" cy="110" r="31" fill="#f8e5b0"/>
        <g className={styles.cloud} fill="#eef0dc" opacity=".5"><ellipse cx="161" cy="122" rx="60" ry="10"/><ellipse cx="304" cy="164" rx="51" ry="8"/></g>
        <path d="M87 222q88-75 159-11t109-18v89H87" fill="#819784"/>
        <path d="M85 252q70-55 146-16t122-2v52H85" fill="#526f61"/>
      </g>
      <path d="M220 47v220m-115-92h232" stroke="#f4eedf" strokeWidth="8"/>
      <rect x="87" y="268" width="270" height="13" rx="4" fill="#a49e87"/>
      <ellipse cx="515" cy="390" rx="260" ry="30" fill="#b6ad96" opacity=".45"/>
      <rect x="649" y="88" width="145" height="9" rx="3" fill="#8b826b"/>
      <path d="M666 87V53h10v34m6 0V48h16v39m6 0V59h9v28" stroke="#788976" strokeWidth="7"/>
      <rect x="744" y="51" width="32" height="36" rx="2" fill="#b58f73"/>
      <circle cx="760" cy="65" r="8" fill="#dec6a2"/>
      <g className={styles.leaves}>
        <path d="M795 322q-8-89 13-142m-12 96q-53-21-38-55 37 4 38 55m5-40q5-55 42-49 1 36-42 49m-2 65q30-45 54-24-15 29-54 24" fill="#647d65" stroke="#647d65" strokeWidth="4"/>
      </g>
      <path d="m768 310 58 0-9 60h-40z" fill="#b98d73"/><path d="M766 309h62v10h-62" fill="#c39a80"/>
      {variant === 'writing' || variant === 'computer' ? <>
        <path d="M430 294v82m103-82v82" stroke="#696c5b" strokeWidth="10"/>
        <rect x="416" y="226" width="111" height="79" rx="23" fill="#829082"/>
        <g className={styles.breathe}>
          <path d="M455 279q-10-63 28-67 36 0 40 67" fill="#ad725a"/>
          <path d="M474 216v-18h23v19" fill="#c39371"/>
          <ellipse cx="488" cy="177" rx="27" ry="31" fill="#cfa380"/>
          <path d="M462 178q-12-45 27-43 33 2 29 37l-12-3-9-15q-5 18-35 24" fill="#47483c"/>
          <path d="m505 239 28 29 47 2" fill="none" stroke="#cfa380" strokeWidth="14" strokeLinecap="round"/>
        </g>
        <path d="M368 291v102m328-102v102" stroke="#78694f" strokeWidth="12"/>
        <rect x="351" y="278" width="362" height="17" rx="5" fill="#968062"/>
        {variant === 'computer' ? <>
          <path d="m558 273-15-71h90l15 71z" fill="#626e66"/><path d="m554 209 11 52h72l-11-52z" fill="#c5d6be"/>
          <path d="M568 224h28m-25 10h45m-42 10h22" stroke="#889e88" strokeWidth="3"/>
          <path className={styles.cursor} d="M601 244h7" stroke="#496356" strokeWidth="3"/>
          <path d="M539 275h118" stroke="#59655e" strokeWidth="5" strokeLinecap="round"/>
        </> : <>
          <path d="m534 272 19-28 69 6-13 23z" fill="#f6eed8"/>
          <path d="m557 254 39 3m-44 4 32 2" stroke="#b8b19a" strokeWidth="2"/>
          <path d="m578 266 17-21" stroke="#4f6559" strokeWidth="4"/>
        </>}
        <path d="M394 252h24v25h-24z" fill="#e6d7b5"/><path d="M418 256q19-2 11 15h-11" fill="none" stroke="#e6d7b5" strokeWidth="5"/>
        <path className={styles.steam} d="M400 242q-9-9 1-18m9 16q8-9 0-18" fill="none" stroke="#fff9e8" strokeWidth="3" strokeLinecap="round"/>
      </> : <>
        <rect x="406" y="237" width="255" height="110" rx="29" fill="#788a79"/>
        <rect x="392" y="289" width="280" height="62" rx="20" fill="#6b7e6f"/>
        <path d="M412 347v32m243-32v32" stroke="#7a6c54" strokeWidth="10"/>
        <rect x="421" y="253" width="68" height="45" rx="12" fill="#bac0a1"/>
        <path d="M550 279q65-20 95 23v38h-95z" fill="#c9b28b"/>
        {variant === 'reading' && <g className={styles.breathe}>
          <ellipse cx="539" cy="213" rx="25" ry="28" fill="#cfa380"/>
          <path d="M513 212q-10-38 25-36 29 0 28 29l-20-7-13 15" fill="#47483c"/>
          <path d="M509 250q30-24 53 0l18 57h-83z" fill="#ad725a"/>
          <path d="m500 259 37 10 31-15-2 36-29 13-32-12z" fill="#eee1bd"/><path d="m537 269 0 34" stroke="#b8a682" strokeWidth="2"/>
        </g>}
        <ellipse cx="334" cy="323" rx="48" ry="12" fill="#9c8768"/>
        <path d="M334 330v49" stroke="#7a6c54" strokeWidth="9"/>
        <path d="M316 300h22v19h-22z" fill="#f0dfbc"/>
        <path className={styles.steam} d="M323 291q-8-9 0-20" stroke="#fff9e8" strokeWidth="3" fill="none"/>
      </>}
      <ellipse cx="687" cy="237" rx="58" ry="68" fill={`url(#${uid}-light)`}/>
      <path d="M713 279V169h-32" stroke="#8b8065" fill="none" strokeWidth="5"/>
      <path d="m657 192 12-29h27l12 29z" fill="#d4b77d"/>
    </>
  )
}
