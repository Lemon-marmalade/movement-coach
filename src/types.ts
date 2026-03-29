export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseData {
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
  timestamp: number;
}

export interface ExerciseReference {
  id: string;
  name: string;
  description: string;
  idealAngles: {
    [key: string]: { min: number; max: number; label: string };
  };
}

export const EXERCISES: ExerciseReference[] = [
  {
    id: 'squat',
    name: 'Squat',
    description: 'Keep your back straight and knees aligned with your toes.',
    idealAngles: {
      knee_angle: { min: 70, max: 110, label: 'Knee Flexion' },
      hip_angle: { min: 60, max: 100, label: 'Hip Flexion' },
      back_angle: { min: 160, max: 180, label: 'Back Alignment' },
    },
  },
  {
    id: 'lunge',
    name: 'Lunge',
    description: 'Step forward and drop your back knee towards the floor.',
    idealAngles: {
      front_knee: { min: 80, max: 100, label: 'Front Knee' },
      back_knee: { min: 80, max: 100, label: 'Back Knee' },
    },
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    description: 'Press the weights overhead while keeping your core tight.',
    idealAngles: {
      shoulder_flexion: { min: 160, max: 180, label: 'Shoulder Flexion' },
      elbow_extension: { min: 170, max: 180, label: 'Elbow Extension' },
    },
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    description: 'Lift the weight from the floor while maintaining a neutral spine.',
    idealAngles: {
      hip_hinge: { min: 45, max: 75, label: 'Hip Hinge' },
      back_flatness: { min: 170, max: 180, label: 'Back Flatness' },
    },
  },
];
