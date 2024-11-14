export const 서수_일_독 = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉"] as const;
export const 서수_일_합 = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"] as const;
export const 서수_십_독 = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"] as const;
export const 서수_십_합 = ["", "열", "스무", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"] as const;
export const 기수_독 = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구", "십"] as const;

export const 서수 = (n: number, type: "합" | "독"): string => {
  if (n < 1 || 99 < n) {
    throw new Error("서수는 1 이상 99 이하의 정수만 지원합니다.");
  }

  const [십, 일] = [Math.floor(n / 10), n % 10];

  if (type === "합") {
    return `${서수_십_합[십]}${서수_일_합[일]}`;
  } else {
    return `${서수_십_독[십]}${서수_일_독[일]}`;
  }
};

export const 기수 = (n: number): string => {
  if (n < 0 || 99 < n) {
    throw new Error("기수는 0 이상 99 이하의 정수만 지원합니다.");
  }

  const [십, 일] = [Math.floor(n / 10), n % 10];

  return `${기수_독[십]}${기수_독[일]}`;
};
