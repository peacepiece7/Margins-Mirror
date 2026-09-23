import type { Locale } from "@/shared/i18n/messages";

const labels = {
  en: {
    audience: { SELF_AI: "Me and AI", SMALL_GROUP: "Small group" },
    disclosure: {
      PRIVATE_CONTEXT: "AI may use private answers",
      REFLECTION_ONLY: "Reflection only",
    },
    facilitation: {
      BEGINNER: "Beginner",
      EXPERIENCED: "Experienced",
      EXPERT: "Expert",
    },
    priority: { OPTIONAL: "Optional", REQUIRED: "Required" },
    purpose: {
      DISCUSSION_PREP: "Discussion preparation",
      ISSUE_EXPLORATION: "Issue exploration",
      THOUGHT_EXPANSION: "Thought expansion",
    },
    sensitivity: { HIGH: "High", LOW: "Low", MEDIUM: "Medium" },
    stage: {
      CLOSING: "Closing",
      EXPERIENCE: "Experience and meaning",
      INTERPRETATION: "Interpretation",
      SOCIAL_VALUE: "Society and values",
      WARM_UP: "Warm-up",
    },
    targetMinutes: { 20: "20 minutes", 40: "40 minutes", 60: "60 minutes" },
  },
  ko: {
    audience: { SELF_AI: "나와 AI", SMALL_GROUP: "소그룹" },
    disclosure: {
      PRIVATE_CONTEXT: "비공개 답변도 AI가 참고",
      REFLECTION_ONLY: "회고만 사용",
    },
    facilitation: { BEGINNER: "초심자", EXPERIENCED: "경험자", EXPERT: "전문가" },
    priority: { OPTIONAL: "선택", REQUIRED: "필수" },
    purpose: {
      DISCUSSION_PREP: "토론 준비",
      ISSUE_EXPLORATION: "쟁점 탐색",
      THOUGHT_EXPANSION: "생각 확장",
    },
    sensitivity: { HIGH: "높음", LOW: "낮음", MEDIUM: "중간" },
    stage: {
      CLOSING: "생각 정리하기",
      EXPERIENCE: "경험과 의미 연결하기",
      INTERPRETATION: "본문 해석하기",
      SOCIAL_VALUE: "사회와 가치로 넓히기",
      WARM_UP: "가볍게 시작하기",
    },
    targetMinutes: { 20: "20분", 40: "40분", 60: "60분" },
  },
} as const;

export const guideStages = [
  "WARM_UP",
  "INTERPRETATION",
  "EXPERIENCE",
  "SOCIAL_VALUE",
  "CLOSING",
] as const;

export function reflectionLabels(locale: Locale) {
  return labels[locale];
}
