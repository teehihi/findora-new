export interface PostDraft {
  type: 'lost' | 'found';
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  rewardPoints: string;
  contactPhone: string;
  imageUri: string | null;
  imageBase64: string | null;
  imageLabel: string;
  confidence: number;
}

const defaultDraft: PostDraft = {
  type: 'lost',
  title: '',
  description: '',
  address: '',
  lat: 10.8505,
  lng: 106.7717,
  rewardPoints: '50',
  contactPhone: '',
  imageUri: null,
  imageBase64: null,
  imageLabel: '',
  confidence: 0.85,
};

let currentDraft: PostDraft = { ...defaultDraft };

export const getPostDraft = (): PostDraft => {
  return currentDraft;
};

export const updatePostDraft = (updates: Partial<PostDraft>) => {
  currentDraft = { ...currentDraft, ...updates };
};

export const clearPostDraft = () => {
  currentDraft = { ...defaultDraft };
};
