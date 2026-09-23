import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import type { Locale } from "@/shared/i18n/messages";
import { colors, spacing } from "@/shared/theme/tokens";
import { AppText } from "@/shared/ui";

import type { DebateResponseStructure, Persona } from "./types";

const seededPersonaLabels: Record<string, Record<Locale, { displayName: string; tone: string }>> = {
  "psychological-counselor": { en: { displayName: "Psychological Counselor", tone: "Emotion and psychology" }, ko: { displayName: "심리상담사", tone: "감정과 심리" } },
  journalist: { en: { displayName: "Journalist", tone: "Context and intent" }, ko: { displayName: "기자", tone: "맥락과 의도" } },
  "elementary-school-teacher": { en: { displayName: "Elementary School Teacher", tone: "Simple and warm explanation" }, ko: { displayName: "초등학교 선생님", tone: "쉽고 따뜻한 설명" } },
  "college-student": { en: { displayName: "College Student", tone: "Peer questions and growth" }, ko: { displayName: "대학생", tone: "또래의 질문과 성장" } },
  "neighborhood-grandmother": { en: { displayName: "Neighborhood Grandmother", tone: "Lived wisdom" }, ko: { displayName: "옆집 할머니", tone: "생활감과 지혜" } },
  soldier: { en: { displayName: "Soldier", tone: "Duty and choice" }, ko: { displayName: "군인", tone: "책임과 선택" } },
  "middle-school-teacher": { en: { displayName: "Middle School Teacher", tone: "Growth and conflict mediation" }, ko: { displayName: "중학교 교사", tone: "성장과 갈등 조율" } },
  lawyer: { en: { displayName: "Lawyer", tone: "Argument and responsibility" }, ko: { displayName: "변호사", tone: "논증과 책임" } },
  "university-professor": { en: { displayName: "University Professor", tone: "Concept and synthesis" }, ko: { displayName: "대학교수", tone: "개념과 종합" } },
  doctor: { en: { displayName: "Doctor", tone: "Body and care" }, ko: { displayName: "의사", tone: "몸과 돌봄" } },
  developer: { en: { displayName: "Developer", tone: "Structure and patterns" }, ko: { displayName: "개발자", tone: "구조와 패턴" } },
  writer: { en: { displayName: "Writer", tone: "Style and expression" }, ko: { displayName: "작가", tone: "문체와 표현" } },
  "literary-critic": { en: { displayName: "Literary Critic", tone: "Structure and symbol" }, ko: { displayName: "문학평론가", tone: "구조와 상징" } },
  philosopher: { en: { displayName: "Philosopher", tone: "Ethics and meaning" }, ko: { displayName: "철학자", tone: "윤리와 의미" } },
  psychologist: { en: { displayName: "Psychologist", tone: "Motivation and relationship" }, ko: { displayName: "심리학자", tone: "동기와 관계" } },
  historian: { en: { displayName: "Historian", tone: "Time and context" }, ko: { displayName: "역사가", tone: "시대와 맥락" } },
  sociologist: { en: { displayName: "Sociologist", tone: "Norms and groups" }, ko: { displayName: "사회학자", tone: "규범과 집단" } },
  editor: { en: { displayName: "Editor", tone: "Structure and readability" }, ko: { displayName: "편집자", tone: "구조와 가독성" } },
  "skeptical-reader": { en: { displayName: "Skeptical Reader", tone: "Evidence check" }, ko: { displayName: "회의적인 독자", tone: "근거 점검" } },
  "book-club-facilitator": { en: { displayName: "Book Club Facilitator", tone: "Conversation flow" }, ko: { displayName: "독서 모임 진행자", tone: "대화 진행" } },
};

const seededAliases = new Map(Object.entries(seededPersonaLabels).flatMap(([name, labels]) => [
  [labels.en.displayName.toLowerCase(), name],
  [labels.ko.displayName.toLowerCase(), name],
]));

function seededPersonaName(persona: Pick<Persona, "displayName" | "name">) {
  if (seededPersonaLabels[persona.name]) return persona.name;
  return seededAliases.get(persona.displayName.toLowerCase());
}

export function localizedPersonaDisplay(persona: Persona, locale: Locale) {
  const seededName = seededPersonaName(persona);
  return seededName ? seededPersonaLabels[seededName][locale] : {
    displayName: persona.displayName,
    tone: persona.tone ?? "",
  };
}

export function SpeakerGlyph({ testID = "speaker-glyph" }: { testID?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.speakerGlyph}
      testID={testID}
    >
      <View style={styles.speakerHead} />
      <View style={styles.speakerBody} />
    </View>
  );
}

export function debateTopicFromWindowTitle(title: string) {
  return title.replace(/^(Debate|토론):\s*/, "");
}

const structuredLine = /^\s*(?:\*\*)?(Claim|Support|Alternative lens|Next question|주장|근거|대안 관점|다음 질문)(?:\*\*)?\s*:\s*(.*)$/i;

function inlineContent(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <AppText key={index} style={styles.strong}>{part.slice(2, -2)}</AppText>
      : part,
  );
}

export function SafeDebateMessage({ content, locale = "en", structure }: { content: string; locale?: Locale; structure?: DebateResponseStructure }) {
  const structuredFields = structure ? [
    [locale === "ko" ? "주장" : "Claim", structure.claim],
    [locale === "ko" ? "근거" : "Support", structure.support],
    [locale === "ko" ? "대안 관점" : "Alternative lens", structure.alternativeLens],
    [locale === "ko" ? "다음 질문" : "Next question", structure.nextQuestion],
  ].filter((field): field is [string, string] => Boolean(field[1])) : [];
  const lines = content.split("\n");
  const structured = structuredFields.length > 0 || lines.some((line) => structuredLine.test(line));
  return (
    <View testID={structured ? "debate-structured-response" : "debate-message-content"}>
      {structuredFields.map(([label, value]) => (
        <AppText key={label} style={styles.structuredLine}>
          <AppText style={styles.strong}>{label}: </AppText>{value}
        </AppText>
      ))}
      {structuredFields.length ? <AppText testID="debate-full-persisted-message">{content}</AppText> : null}
      {structuredFields.length === 0 ? lines.map((line, index) => {
        const match = line.match(structuredLine);
        return (
          <AppText key={`${index}-${line}`} style={match && styles.structuredLine}>
            {match ? <><AppText style={styles.strong}>{match[1]}: </AppText>{inlineContent(match[2])}</> : inlineContent(line || "\u00a0")}
          </AppText>
        );
      }) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  speakerBody: { backgroundColor: colors.navy, borderRadius: 6, height: 8, width: 18 },
  speakerGlyph: { alignItems: "center", gap: 2, height: 22, justifyContent: "center", width: 22 },
  speakerHead: { backgroundColor: colors.navy, borderRadius: 4, height: 8, width: 8 },
  strong: { fontWeight: "700" },
  structuredLine: { paddingBottom: spacing.x1 },
});
