import type { ReactNode } from 'react'
import type { ScenePreset } from '@/lib/day-scenes'
import { HomeScene } from './home'
import { BikingScene, DrivingScene, RunningScene, SmokingScene, WalkingScene } from './outdoors'
import { GymScene, HomeWorkoutScene } from './movement'
import { ArtScene, BathroomScene, DoctorScene, EatingScene, LibraryScene, MusicScene, TradingScene } from './indoors'

/**
 * Scene registry. Adding a scene: add its key to SCENE_PRESET_KEYS in lib/day-scenes.ts,
 * draw it in this folder (see primitives.tsx), and add an entry here. The Today page doesn't change.
 * Scenes know nothing about plans, clocks, check-ins, or audio.
 */
export type SceneGroup = 'Work & study' | 'Movement' | 'Everyday' | 'Out & about'

export interface SceneConfig {
  label: string
  group: SceneGroup
  /** Short suggestion shown in the editor. */
  hint: string
  render: (uid: string) => ReactNode
}

export const SCENE_GROUPS: SceneGroup[] = ['Work & study', 'Movement', 'Everyday', 'Out & about']

export const SCENE_PRESETS: Record<ScenePreset, SceneConfig> = {
  writing: { label: 'Writing desk', group: 'Work & study', hint: 'Writing, journaling, sketching', render: uid => <HomeScene uid={uid} variant="writing" /> },
  computer: { label: 'At the computer', group: 'Work & study', hint: 'Programming, design, admin', render: uid => <HomeScene uid={uid} variant="computer" /> },
  trading: { label: 'Day trading', group: 'Work & study', hint: 'Charts and markets', render: uid => <TradingScene uid={uid} /> },
  library: { label: 'Studying at the library', group: 'Work & study', hint: 'Library, Chicago Athletic Association', render: uid => <LibraryScene uid={uid} /> },
  reading: { label: 'Reading nook', group: 'Work & study', hint: 'Reading, study, listening', render: uid => <HomeScene uid={uid} variant="reading" /> },
  music: { label: 'Playing music', group: 'Work & study', hint: 'Guitar, practice, jamming', render: uid => <MusicScene uid={uid} /> },
  art: { label: 'Making art', group: 'Work & study', hint: 'Painting, drawing, sketching', render: uid => <ArtScene uid={uid} /> },
  walking: { label: 'Walking outside', group: 'Movement', hint: 'A walk in the park', render: uid => <WalkingScene uid={uid} /> },
  running: { label: 'Running outside', group: 'Movement', hint: 'A run along the lake', render: uid => <RunningScene uid={uid} /> },
  biking: { label: 'Biking outside', group: 'Movement', hint: 'A ride on the trail', render: uid => <BikingScene uid={uid} /> },
  gym: { label: 'At the gym', group: 'Movement', hint: 'Weights and machines', render: uid => <GymScene uid={uid} /> },
  home_workout: { label: 'Exercising in my room', group: 'Movement', hint: 'Bodyweight, stretching', render: uid => <HomeWorkoutScene uid={uid} /> },
  eating: { label: 'Eating', group: 'Everyday', hint: 'Breakfast, lunch, dinner', render: uid => <EatingScene uid={uid} /> },
  smoking: { label: 'Smoking', group: 'Everyday', hint: 'A break on the balcony', render: uid => <SmokingScene uid={uid} /> },
  bathroom: { label: 'Bathroom', group: 'Everyday', hint: 'Shower, getting ready', render: uid => <BathroomScene uid={uid} /> },
  quiet: { label: 'Quiet room', group: 'Everyday', hint: 'Rest, anything else', render: uid => <HomeScene uid={uid} variant="quiet" /> },
  driving: { label: 'Traveling by car', group: 'Out & about', hint: 'Driving, rides, errands', render: uid => <DrivingScene uid={uid} /> },
  doctor: { label: "Doctor's office", group: 'Out & about', hint: 'Appointments, waiting rooms', render: uid => <DoctorScene uid={uid} /> },
}
