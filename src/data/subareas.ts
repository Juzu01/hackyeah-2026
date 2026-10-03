// One level of "zoom" for regions where it matters (WebMD zooms into the head;
// Infermedica splits the abdomen). Implemented as filters over the region's
// symptom list rather than extra geometry.

export interface SubArea {
  id: string
  label: string
  symptoms: string[]
}

export const SUBAREAS: Record<string, SubArea[]> = {
  head: [
    { id: 'whole', label: 'Cała głowa', symptoms: ['headache', 'headache-one-sided-pulsing', 'headache-pressure-band', 'occipital-pain', 'light-sound-sensitivity', 'dizziness', 'head-injury', 'neck-stiff', 'vomiting', 'face-swelling'] },
    { id: 'eyes', label: 'Oczy', symptoms: ['eye-pain', 'eye-red', 'vision-blur', 'light-sound-sensitivity'] },
    { id: 'ears', label: 'Uszy', symptoms: ['ear-pain', 'ear-hearing', 'dizziness'] },
    { id: 'nose', label: 'Nos i zatoki', symptoms: ['runny-nose', 'sinus-pressure', 'face-swelling'] },
    { id: 'mouth', label: 'Jama ustna i żuchwa', symptoms: ['tooth-pain', 'jaw-pain', 'face-swelling'] },
  ],
}

/** Skin complaints are not tied to one region (WebMD and Healthwise keep a separate "Skin" entry). */
export const SKIN_SYMPTOMS = ['rash', 'hand-rash', 'foot-skin', 'rash-genital', 'shin-skin-red', 'face-swelling', 'toenail']
