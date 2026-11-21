import { DIALOGUE_TURN_PAUSE_SECONDS, sentencePauseSeconds, SPEECH_SPEED_FACTOR, splitSpeechSentences } from './speech-pacing'
import type { CinematicScene, DialogueTurn, MeditationDefinition, MeditationPhase, MeditationUnit, ScriptVariant, UnitType } from './types'

/** Scripts are the source of truth. Increment the unit/turn scriptVersion after editing
 * spoken words; an audio asset remains usable only while its scriptVersion matches.
 * Durations are deliberately relaxed estimates; the player never cuts off speech. */
export function estimateSpeechSeconds(text: string, type: UnitType = 'narration'): number {
  const sentences = splitSpeechSentences(text)
  if (!sentences.length) return 0
  const originalSpeechSeconds = Math.max(1.5, text.trim().split(/\s+/).length * 0.5 + (text.match(/[.!?…]/g)?.length ?? 0) * 0.22)
  const pauses = (sentences.length - 1) * sentencePauseSeconds(type)
  return Math.round((originalSpeechSeconds / SPEECH_SPEED_FACTOR + pauses) * 100) / 100
}

function variant(text: string, type: UnitType = 'narration'): ScriptVariant {
  return { text, estimatedDurationSeconds: estimateSpeechSeconds(text, type) }
}

type UnitInput = {
  id: string
  phase: MeditationPhase
  type?: UnitType
  effect: string
  text: string
  short?: string
  medium?: string
  long?: string
  min?: number
  max?: number
  scriptVersion?: string
}

function line(input: UnitInput): MeditationUnit {
  return {
    id: input.id,
    type: input.type ?? 'narration',
    phase: input.phase,
    emotionalEffect: input.effect,
    text: input.text,
    scriptVersion: input.scriptVersion ?? '1',
    characterId: 'narrator',
    estimatedDurationSeconds: estimateSpeechSeconds(input.text, input.type),
    minSessionSeconds: input.min ?? 60,
    maxSessionSeconds: input.max ?? 900,
    transition: { beforeSeconds: 0, afterSeconds: input.type === 'closing' ? 0 : 1 },
    variants: {
      ...(input.short ? { short: variant(input.short, input.type) } : {}),
      ...(input.medium ? { medium: variant(input.medium, input.type) } : {}),
      ...(input.long ? { long: variant(input.long, input.type) } : {}),
    },
  }
}

function scene(id: string, title: string, category: CinematicScene['category'], turns: [string, string][]): CinematicScene {
  return {
    id, title, category, scriptVersion: '1',
    turns: turns.map(([characterId, text], index): DialogueTurn => ({
      id: `${id}-${index + 1}`, characterId, scriptVersion: '1', ...variant(text, 'cinematic-dialogue'),
    })),
  }
}

function sceneUnit(scene: CinematicScene, phase: MeditationPhase, min = 60): MeditationUnit {
  return {
    id: `${scene.id}-scene`, type: 'cinematic-dialogue', phase,
    emotionalEffect: scene.category, scriptVersion: scene.scriptVersion, text: '', sceneId: scene.id,
    estimatedDurationSeconds: scene.turns.reduce((sum, turn) => sum + turn.estimatedDurationSeconds, 0) + Math.max(0, scene.turns.length - 1) * DIALOGUE_TURN_PAUSE_SECONDS,
    minSessionSeconds: min, maxSessionSeconds: 900,
    transition: { beforeSeconds: 1.5, afterSeconds: 2 },
  }
}

const dinner = scene('got-it-dinner', 'Dinner', 'responsibility', [
  ['alex', 'Who’s making dinner?'],
  ['sam', 'You know what? I got it.'],
  ['alex', 'You sure?'],
  ['sam', 'Yeah. I’ve got an idea.'],
])
const dinnerResult = scene('got-it-dinner-result', 'At the table', 'responsibility', [
  ['alex', 'Wait. You made this?'],
  ['sam', 'Yeah!'],
  ['alex', 'This is amazing!'],
  ['sam', 'I got it!'],
])
const offer = scene('got-it-offer', 'The offer', 'receiving', [
  ['alex', 'They said yes!'],
  ['sam', 'Wait, really?'],
  ['alex', 'You got the offer!'],
  ['sam', 'Oh my God. I got it!'],
])
const customer = scene('got-it-first-customer', 'First customer', 'both', [
  ['alex', 'We got our first customer!'],
  ['sam', 'I got it! I actually got it!'],
  ['alex', 'Can you take care of the order?'],
  ['sam', 'Absolutely. I got it.'],
])

function recalls(prefix: string, phrase: string, capability: string): MeditationUnit[] {
  const prompts: [MeditationPhase, string, string][] = [
    ['past', `Remember one moment of ${capability}. ${phrase}`, `Remember a moment when you felt ${capability}. Let one detail return: a face, a place, or a breath. Notice what you felt. ${phrase}`],
    ['present', `Meet today with ${capability}. ${phrase}`, `Bring one small opportunity from today to mind. Imagine meeting it with ${capability}. Feel your feet beneath you. You can choose one next step. ${phrase}`],
    ['future', `Imagine feeling ${capability}. ${phrase}`, `Imagine one welcome moment ahead. Picture discovering that something you care about has happened. Notice the feeling, without needing to know how things will unfold. ${phrase}`],
    ['feeling', `Recall your ${capability}. ${phrase}`, `Recall a feeling of ${capability} you have explored before. Let the scene be simple. As the image softens, stay with the feeling. ${phrase}`],
  ]
  return prompts.map(([phase, short, medium]) => line({
    id: `${prefix}-recall-${phase}`, phase, type: 'emotional-recall', effect: capability,
    text: medium, short, min: 10, max: 59, scriptVersion: '2',
  }))
}

const gotItUnits: MeditationUnit[] = [
  ...recalls('got-it', 'I got it.', 'capability'),
  line({ id: 'got-it-arrive', phase: 'arrival', type: 'breathing-guidance', min: 300, effect: 'ease',
    text: 'Find a position that feels supported. Let your breathing stay comfortable. There is no rhythm to achieve. If you like, notice the quiet movement of your breath, or a heartbeat. You can keep your eyes open or let them close.',
    long: 'Settle somewhere you can give yourself a few quiet minutes. Feel the support beneath you. Your breathing can stay exactly as it is; there is no need to deepen it or hold it. If it feels comfortable, notice one breath arriving and leaving. Perhaps you can sense a heartbeat. If not, the contact of your feet or hands is enough.' }),
  line({ id: 'got-it-intention', phase: 'intention', min: 300, effect: 'possibility',
    text: 'Bring a desire, an intention, or a feeling to mind. It might be about a relationship, a project, money, or simply feeling more at home in your day. Let it be something that matters to you. You do not need to solve it now.',
    long: 'What would you like to welcome into your life? Perhaps an opportunity, a payment you have worked toward, a new skill, or a more generous way of being with someone. Underneath the outcome, what feeling matters? Relief, confidence, connection, or something else? Let that feeling give this practice a direction. Imagining it is a way to explore your experience, not a guarantee of what will happen.' }),
  line({ id: 'got-it-past', phase: 'past', type: 'visualization-prompt', effect: 'remembered capability',
    short: 'Remember a time you stepped forward. Feel that capability again. I got it.',
    text: 'Remember a time you stepped forward to take responsibility for something. Maybe you knew what to do. Maybe you weren’t completely sure. Remember what happened. What surprised you?',
    long: 'Remember a time you stepped forward to take responsibility for something. It can be an ordinary moment: making dinner, beginning an intimidating project, or helping solve a problem. Maybe you knew what to do. Maybe you weren’t completely sure. Where were you? Who else was there? Remember the moment you decided to begin, and then what happened. What surprised you?' }),
  sceneUnit(dinner, 'past'),
  line({ id: 'got-it-past-detail', phase: 'past', type: 'emotional-recall', min: 300, effect: 'earned confidence',
    text: 'Return to your own memory. What changed when you stepped forward? Maybe your shoulders softened, your attention became clear, or someone trusted you. You do not have to make the memory perfect. Let the part that felt capable be enough.',
    long: 'Stay with one detail from that memory. Perhaps you can hear a voice, feel something in your hands, or remember someone’s expression. Notice the difference between the moment before you began and the moment you realized you could handle it. The result did not need to be flawless. There may still have been uncertainty. Find the feeling of participation: you were there, and you did something that mattered.' }),
  sceneUnit(dinnerResult, 'past', 600),
  line({ id: 'got-it-past-receiving', phase: 'past', type: 'emotional-recall', min: 600, effect: 'gratitude',
    text: 'There may also be a memory of receiving. A gift, an acceptance, a payment, or good news you had been waiting for. Remember the first instant you understood. Before you explained it, before you planned what came next, how did it feel to receive? Let a little of that feeling be here.' }),
  line({ id: 'got-it-present', phase: 'present', type: 'visualization-prompt', effect: 'willingness',
    short: 'Picture one thing you could begin today. Imagine stepping forward. I got it.',
    text: 'Think of something available to do today. Something you could begin, create, solve, or take responsibility for. Imagine yourself stepping forward. I got it.',
    long: 'Think of something available to do today. Something you could begin, create, solve, or take responsibility for. It can be small enough to start without having everything figured out. Picture where you would be and what you would do first. Imagine yourself stepping forward, with the confidence you remember and room for whatever you still need to learn. I got it.' }),
  sceneUnit(customer, 'present'),
  line({ id: 'got-it-present-detail', phase: 'present', type: 'visualization-prompt', min: 600, effect: 'grounded agency',
    text: 'Imagine the first practical movement: opening the document, asking a clear question, preparing the ingredients, or contacting someone. Notice that accepting responsibility does not mean doing everything alone. You can ask for help, choose a reasonable boundary, and still step forward. Let the scene unfold at a human pace.' }),
  line({ id: 'got-it-future', phase: 'future', type: 'visualization-prompt', effect: 'receptivity',
    short: 'Imagine receiving something you’ve wanted. Feel that moment of discovery. I got it.',
    text: 'Imagine receiving something you’ve wanted. Maybe an offer. A payment. An opportunity. Imagine discovering that it happened. Feel the excitement, relief, or gratitude. I got it.',
    long: 'Imagine receiving something you’ve wanted. Maybe an offer, a payment, an opportunity, a place at college, or a goal you have worked toward. Choose one moment of discovery. Where are you? What do you see or hear? Imagine it as a moment happening now. Give yourself room to notice excitement, relief, or gratitude, whatever feels natural. I got it.' }),
  sceneUnit(offer, 'future'),
  line({ id: 'got-it-future-detail', phase: 'future', type: 'visualization-prompt', min: 600, effect: 'receiving and responding',
    text: 'What happens just after that first excitement? Perhaps you tell someone, smile to yourself, or take a breath. Imagine receiving the good news and then responding with care. There may be a new responsibility inside this opportunity. You can welcome both: the pleasure of receiving, and the willingness to begin.' }),
  line({ id: 'got-it-comparison', phase: 'feeling', type: 'emotional-recall', min: 300, effect: 'emotional integration',
    text: 'Notice the feeling you found. If you explored more than one moment, what was familiar between them? What felt different? Perhaps the steadiness of taking responsibility can sit beside the openness of receiving. Let them meet without forcing them to become the same.',
    long: 'Notice what your body and attention remember from this practice. If you explored several moments, gently compare them. What did capability feel like? What did receiving feel like? Perhaps one brought steadiness and another brought warmth. Let the useful parts exist together. You do not need to produce a stronger emotion. A subtle feeling is enough, and a quiet or uncertain response belongs here too.' }),
  line({ id: 'got-it-feeling', phase: 'feeling', type: 'emotional-recall', effect: 'resting in feeling',
    short: 'Let the images fade. Rest in the feeling.',
    text: 'Let the images fade. Let the words fall away. Rest in whatever feeling you’ve discovered.',
    long: 'Now let the images fade. Let the characters and their words fall away. There is nothing more you need to rehearse for a while. Rest in whatever feeling you have discovered. If your attention wanders, you can notice the support beneath you and return gently. We will leave some quiet space here.' }),
  line({ id: 'got-it-action', phase: 'action', type: 'inspired-action', effect: 'practical agency',
    short: 'Choose one small step. Bring this feeling with you.',
    text: 'Think about one small thing you could do to move toward what you want. When you’re ready, bring this feeling with you.',
    long: 'From this feeling, consider one small thing you could do to move toward what you want. Something concrete and kind enough to begin: send a message, make a plan, ask for help, or give a task a few minutes. You do not have to decide everything. Choose one possibility you can return to when this practice ends.' }),
  line({ id: 'got-it-return', phase: 'return', type: 'closing', effect: 'gentle return',
    text: 'Notice the room around you. Take your time. I got it.',
    long: 'Notice the room around you, and let your eyes open if they were closed. Later, you might compare a real moment with what you imagined. What felt familiar? What surprised you? Let experience teach you something new. For now, take your time, and bring whatever was useful into the day. I got it.' }),
]

const workout = scene('strong-workout', 'The last stretch', 'resilience', [
  ['alex', 'That was the part I thought I couldn’t do.'],
  ['sam', 'You found your pace.'],
  ['alex', 'I did. I am strong.'],
  ['sam', 'And you listened when you needed a break.'],
])
const setback = scene('strong-start-again', 'Starting again', 'resilience', [
  ['alex', 'It didn’t work the way I hoped.'],
  ['sam', 'What do you want to try next?'],
  ['alex', 'A smaller step. And some help this time.'],
  ['sam', 'I’m here.'],
  ['alex', 'I am strong. I can begin again.'],
])

const strongUnits: MeditationUnit[] = [
  ...recalls('strong', 'I am strong.', 'strength'),
  line({ id: 'strong-arrive', phase: 'arrival', type: 'breathing-guidance', min: 300, effect: 'support',
    text: 'Find a comfortable position. Let your breathing be easy and unforced. Feel the support beneath you. If noticing your breath or heartbeat feels helpful, you can do that. You can also simply listen.' }),
  line({ id: 'strong-intention', phase: 'intention', min: 300, effect: 'self-directed courage',
    text: 'Bring to mind a quality of strength you would like to know more closely. It might be courage, patience, persistence, or the ability to ask for help. You can choose what strength means for you today.' }),
  line({ id: 'strong-past', phase: 'past', type: 'visualization-prompt', effect: 'remembered resilience',
    short: 'Remember doing something difficult. What helped you keep going? I am strong.',
    text: 'Remember a time you did something difficult. Maybe you finished a workout, learned a new skill, or got through a demanding day. Choose a memory that feels comfortable to revisit. What helped you keep going?',
    long: 'Remember a time you did something difficult. Maybe you finished a workout, learned a skill, or got through a demanding day. Choose an experience that feels comfortable to revisit; it does not need to be your hardest moment. Remember where you were, what supported you, and one decision you made. Strength may have looked like continuing, resting, or asking someone to stand beside you.' }),
  sceneUnit(workout, 'past'),
  line({ id: 'strong-past-detail', phase: 'past', type: 'emotional-recall', min: 300, effect: 'earned self-trust',
    text: 'Notice one detail from that memory. How did you recognize your own effort? Perhaps no one else saw it. You can acknowledge it now. Let the memory remind you of a capacity you already have, without requiring you to prove it again.' }),
  line({ id: 'strong-present', phase: 'present', type: 'visualization-prompt', effect: 'courage',
    short: 'Picture one manageable step into today’s challenge. I am strong.',
    text: 'Bring one present challenge to mind. Choose a manageable part of it. Imagine approaching that part with steadiness, allowing yourself support and time. You do not need to be fearless. I am strong.',
    long: 'Bring one present challenge to mind. Rather than taking on the whole thing, choose one manageable part. Imagine the first step: a conversation, a few minutes of effort, or a clear request for support. Notice how it feels to approach this with steadiness and permission to learn. Courage can include uncertainty. I am strong.' }),
  sceneUnit(setback, 'present'),
  line({ id: 'strong-present-detail', phase: 'present', type: 'narration', min: 600, effect: 'flexibility',
    text: 'If something does not go as you hope, imagine pausing before judging yourself. What information could the setback offer? What could you change? Picture making one adjustment. Persistence does not require repeating what hurts; it can mean finding a kinder and more workable way forward.' }),
  line({ id: 'strong-future', phase: 'future', type: 'visualization-prompt', effect: 'future self-trust',
    short: 'Imagine finding your footing in a future challenge. I am strong.',
    text: 'Imagine meeting a future challenge. See yourself finding your footing, learning what you need, and taking a step. Let the scene include help, rest, and another beginning. I am strong.',
    long: 'Imagine a future moment that asks something of you. You cannot know every detail, but you can picture yourself finding your footing. Notice your surroundings. Imagine gathering information, accepting support, and taking a step. Perhaps you will need a pause and another beginning. Let strength be the capacity to respond, not a promise that nothing will be difficult.' }),
  line({ id: 'strong-comparison', phase: 'feeling', type: 'emotional-recall', min: 300, effect: 'integrated resilience',
    text: 'Notice the feeling of strength in this practice. If you explored several moments, what did they share? Perhaps patience from one experience can join courage from another. Let your own definition of strength become a little more spacious.' }),
  line({ id: 'strong-feeling', phase: 'feeling', type: 'emotional-recall', effect: 'quiet confidence',
    short: 'Let the scene soften. Rest in the steadiness you found.',
    text: 'Let the scene and the words soften. Rest in whatever steadiness you have found. A quiet feeling counts. There is nothing you need to prove here.',
    long: 'Let the scene and the words soften. You do not need to keep picturing an achievement. Rest in whatever steadiness you have found, even if it is subtle. Feel the support beneath you. If attention wanders, you can gently return. We will leave some quiet space for that feeling.' }),
  line({ id: 'strong-action', phase: 'action', type: 'inspired-action', effect: 'supported action',
    short: 'Choose one small action to support yourself today.',
    text: 'Choose one small action that would support you today. It might be a beginning, a pause, or a request for help. Let strength take that practical shape.' }),
  line({ id: 'strong-return', phase: 'return', type: 'closing', effect: 'gentle return',
    text: 'Notice the room around you. Take your time. I am strong.',
    long: 'Bring your attention back to the room. Later, notice a real moment when you draw on strength. How did it compare with what you imagined? What did you learn? There is room to keep discovering. Take your time. I am strong.' }),
]

export const MEDITATIONS: MeditationDefinition[] = [
  {
    id: 'i-got-it', title: 'I Got It', description: 'Remember your capability. Welcome possibility. Find the feeling where taking responsibility and receiving meet.',
    theme: 'Capability & receiving', catchphrase: 'I got it.',
    availability: 'free', status: 'published', contentVersion: '1.1.0', accent: 'amber', units: gotItUnits,
    scenes: [dinner, dinnerResult, offer, customer],
  },
  {
    id: 'i-am-strong', title: 'I Am Strong', description: 'Reconnect with resilience, courage, and the strength to begin again. Make room for effort, rest, and support.',
    theme: 'Resilience & courage', catchphrase: 'I am strong.',
    availability: 'free', status: 'published', contentVersion: '1.1.0', accent: 'sage', units: strongUnits, scenes: [workout, setback],
  },
  {
    id: 'i-am-lucky', title: 'I Am Lucky', description: 'A practice for noticing unexpected kindness, welcome coincidences, and possibilities already around you.',
    theme: 'Gratitude & possibility', catchphrase: 'I am lucky.',
    availability: 'free', status: 'draft', contentVersion: '0.2.0', accent: 'lavender',
    units: recalls('lucky', 'I am lucky.', 'gratitude'), scenes: [],
  },
]

export function getMeditation(id: string): MeditationDefinition | undefined {
  return MEDITATIONS.find(meditation => meditation.id === id)
}

/** Templates stay with the editable creative source, not the audio player. */
export const PERSONALIZATION_TEMPLATES = {
  intention: 'Bring your intention to mind: {anchor}. Notice why it matters to you. Let it gently guide this practice.',
  past: 'Bring your own memory to mind: {anchor}. Recall one detail and the feeling it brings. Let that feeling be here.',
  present: 'Bring this present opportunity to mind: {anchor}. Imagine one manageable step you could take. Notice how you want to meet it.',
  future: 'Imagine this possibility: {anchor}. Picture a moment of discovery, and notice the feeling. You do not have to know how it will unfold.',
  feeling: 'Let the images and words soften. Make room for this feeling: {anchor}. There is nothing to force. Rest here for a while.',
} as const
