import type { JourneyStage, PreserveStackItem } from './types';

export const preserveStackItems: PreserveStackItem[] = [
  { id: 'original', src: '/landing/preserve-original.webp', label: 'ORIGINAL' },
  { id: 'interview', src: '/landing/preserve-interview.webp', label: 'INTERVIEW' },
  { id: 'guide', src: '/landing/preserve-guide.webp', label: 'GUIDE' },
  { id: 'revision', src: '/landing/preserve-revision.webp', label: 'REVISION' },
];

export const journeyStages: JourneyStage[] = [
  {
    number: '00',
    titleKey: 'mainPromotionFeatureDiscover',
    detailKey: 'landingStageDiscoverDetail',
    captionKey: 'landingStageDiscoverCaption',
    image: '/landing/stage-discover.webp',
    width: 546,
    height: 732,
  },
  {
    number: '01',
    titleKey: 'reflectionStepReflect',
    detailKey: 'landingStageReflectDetail',
    captionKey: 'landingStageReflectCaption',
    image: '/landing/stage-reflect.webp',
    width: 550,
    height: 725,
  },
  {
    number: '02',
    titleKey: 'reflectionStepInterview',
    detailKey: 'landingStageInterviewDetail',
    captionKey: 'landingStageInterviewCaption',
    image: '/landing/stage-interview.webp',
    width: 624,
    height: 878,
  },
  {
    number: '03',
    titleKey: 'reflectionStepGuide',
    detailKey: 'landingStageGuideDetail',
    captionKey: 'landingStageGuideCaption',
    image: '/landing/stage-guide.webp',
    width: 575,
    height: 826,
  },
  {
    number: '04',
    titleKey: 'reflectionStepDiscuss',
    detailKey: 'landingStageDiscussDetail',
    captionKey: 'landingStageDiscussCaption',
    image: '/landing/stage-discuss.webp',
    width: 551,
    height: 725,
  },
  {
    number: '05',
    titleKey: 'reflectionStepRefine',
    detailKey: 'landingStageRefineDetail',
    captionKey: 'landingStageRefineCaption',
    image: '/landing/stage-refine.webp',
    width: 615,
    height: 863,
  },
];
