const copy = {
  en: {
    backToCurrent: "Current Service Terms status",
    contact: "Contact support",
    history: "Service Terms history",
    historyEmptyBody:
      "A version will appear here only after the operator information and Korean source have been confirmed and the document has completed legal review.",
    historyEmptyTitle: "There are no published versions.",
    historyTitle: "Service Terms History",
    noAcceptance:
      "No Service Terms acceptance is currently requested, recorded, or used to restrict access.",
    pendingBody:
      "Margins is preparing verified operator information, a legally reviewed Korean source, and an English convenience translation.",
    pendingTitle: "No version is published yet",
    privacy: "Privacy Policy",
    status: "Publication status: preparing for legal review",
    title: "Service Terms",
  },
  ko: {
    backToCurrent: "현재 서비스 이용약관 상태",
    contact: "문의하기",
    history: "서비스 이용약관 변경 이력",
    historyEmptyBody:
      "운영자 정보와 국문 원문이 확정되고 법률 검토를 마친 문서만 이곳에 게시합니다.",
    historyEmptyTitle: "게시된 버전이 없습니다.",
    historyTitle: "서비스 이용약관 변경 이력",
    noAcceptance:
      "현재 서비스 이용약관 동의를 요구하거나 저장하지 않으며, 이를 이유로 서비스 이용을 제한하지 않습니다.",
    pendingBody:
      "Margins는 확인된 운영자 정보, 법률 검토를 거친 국문 원문과 영문 편의 번역을 준비하고 있습니다.",
    pendingTitle: "아직 게시된 버전이 없습니다",
    privacy: "개인정보처리방침",
    status: "게시 상태: 법률 검토 준비 중",
    title: "서비스 이용약관",
  },
} as const;

export function serviceTermsCopy(locale: "en" | "ko") {
  return copy[locale];
}
