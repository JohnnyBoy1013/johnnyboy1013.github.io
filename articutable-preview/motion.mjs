// Limits and reference poses recorded by the Isaac joint-cycle capture.
// The drawer's video-safe limit is intentionally narrower than its source GLB limit.
export const videoJoints = {
  adjustable_desk_lamp_0: {
    joint_1: [0, 2.094395160675049, 0.935114688295087],
    joint_2: [0, 3.1415927410125732, 1.203049999245779],
    joint_3: [0, 3.1415927410125732, 1.1114202135160764],
  },
  scissors_0: { joint_1: [0, 0.7853981852531433, 0] },
  water_bottle_0: { joint_1: [0, 6.2831854820251465, 0] },
  storage_drawer_box_0: { joint_1: [0, 0.17170491814613342, 0] },
  laptop_computer_0: { joint_1: [0, 2.356194496154785, 1.860308406069311] },
};

export const videoFrameCount = 192;
export const videoFps = 24;

export function referenceCyclePosition([lower, upper, reference], phase) {
  const distance = Math.min(Math.max(phase, 0), 1) * 2 * (upper - lower);
  const firstTurn = upper - reference;
  const secondTurn = firstTurn + upper - lower;
  if (distance <= firstTurn) return reference + distance;
  if (distance <= secondTurn) return upper - (distance - firstTurn);
  return lower + distance - secondTurn;
}

export function toSourcePosition(value, [videoLower, videoUpper], [sourceLower, sourceUpper]) {
  return sourceLower + (value - videoLower) * (sourceUpper - sourceLower) / (videoUpper - videoLower);
}
