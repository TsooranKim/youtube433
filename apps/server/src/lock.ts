let isGeneratingQuiz = false;
let isGeneratingYoutube = false;

export function getIsGeneratingQuiz(): boolean {
  return isGeneratingQuiz;
}

export function setIsGeneratingQuiz(value: boolean): void {
  isGeneratingQuiz = value;
}

export function getIsGeneratingYoutube(): boolean {
  return isGeneratingYoutube;
}

export function setIsGeneratingYoutube(value: boolean): void {
  isGeneratingYoutube = value;
}
