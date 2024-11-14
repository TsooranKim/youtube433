import type { Quiz } from "schema";

import {
  ANSWER_MOGRT_PATH,
  AudioTrackIndex,
  DELAY_AFTER_QUESTION_SECONDS,
  QUESTION_MOGRT_PATH,
  SEQUENCE_PRESET_PATH,
  TITLE_MOGRT_PATHS,
  TTS_MDEIA_BASE_PATH,
  VideoTrackIndex,
  순서,
} from "./short/constants";

const PROJECT_ITEM_MEDIA_PATH_MAP: Record<string, ProjectItem> = {};

export const createSequence = (name: string): Sequence => {
  const file = new File(SEQUENCE_PRESET_PATH);
  if (!file.exists) {
    throw new Error(`${SEQUENCE_PRESET_PATH} not found`);
  }

  for (let i = 0; i < app.project.sequences.numSequences; i++) {
    const sequence = app.project.sequences[i];
    if (sequence.name === name) {
      app.project.deleteSequence(sequence);
    }
  }

  return (
    app.project as Project & {
      newSequence: (name: string, pathToSequencePreset: string) => Sequence;
    }
  ).newSequence(name, SEQUENCE_PRESET_PATH);
};

const findExistingProjectItem = (filepath: string): ProjectItem | null => {
  const existingProjectItem = PROJECT_ITEM_MEDIA_PATH_MAP[filepath];
  if (existingProjectItem) {
    return existingProjectItem;
  }

  for (let i = 0; i < app.project.rootItem.children.numItems; i++) {
    const item = app.project.rootItem.children[i];
    const pathOfItem = item.getMediaPath();
    if (pathOfItem === filepath) {
      PROJECT_ITEM_MEDIA_PATH_MAP[filepath] = item;
      return item;
    }
  }

  return null;
};

export const loadFile = (filepath: string): ProjectItem => {
  const file = new File(filepath);
  if (!file.exists) {
    throw new Error(`${filepath} not found`);
  }

  const existingProjectItem = findExistingProjectItem(filepath);
  if (existingProjectItem != null) {
    return existingProjectItem;
  }

  const projectBins = [app.project.rootItem, app.project.getInsertionBin()];
  for (const projectBin of projectBins) {
    app.project.importFiles([filepath], true, projectBin, false);
    for (let i = 0; i < app.project.rootItem.children.numItems; i++) {
      const item = app.project.rootItem.children[i];
      const pathOfItem = item.getMediaPath();
      if (pathOfItem === filepath) {
        PROJECT_ITEM_MEDIA_PATH_MAP[filepath] = item;
        return item;
      }
    }
  }

  throw new Error(`${filepath} not loaded`);
};

const setVolume = (trackItem: TrackItem, volume: number) => {
  for (var i = 0; i < trackItem.components.numItems; i++) {
    var component = trackItem.components[i];
    if (component.displayName === "Volume") {
      for (var j = 0; j < component.properties.numItems; j++) {
        var property = component.properties[j];
        if (property.displayName === "Level") {
          property.setValue(volume);
          return;
        }
      }
    }
  }
};

export const addQuiz = (sequence: Sequence, quiz: Quiz, quizNumber: string, startTicks: Time["ticks"]): TrackItem => {
  const titleTrackItem = sequence.importMGT(
    TITLE_MOGRT_PATHS[quizNumber],
    startTicks,
    VideoTrackIndex.TITLE,
    AudioTrackIndex.DUMMY,
  );

  const questionTrackItem = sequence.importMGT(
    QUESTION_MOGRT_PATH,
    startTicks,
    VideoTrackIndex.QUESTION,
    AudioTrackIndex.DUMMY,
  );

  const questionMogrt = questionTrackItem.getMGTComponent();

  for (let i = 0; i < questionMogrt.properties.numItems; i++) {
    const property = questionMogrt.properties[i];
    switch (property.displayName) {
      case "첫번쨰 질문": {
        let question = quiz.question;
        const length = question.length;
        if (length > 14) {
          const words = question.split(" ");
          const half = Math.ceil(words.length / 2);
          const first = words.slice(0, half).join(" ");
          const second = words.slice(half).join(" ");
          question = [first, second].join("\n");
        }
        property.setValue(`<${순서[quizNumber]}>\n${question}`);
        break;
      }
      case "1번.정답":
        property.setValue(`1번. ${quiz.choices[0]}`);
        break;
      case "2번.정답":
        property.setValue(`2번. ${quiz.choices[1]}`);
        break;
      case "3번.정답":
        property.setValue(`3번. ${quiz.choices[2]}`);
        break;
      case "4번.정답":
        property.setValue(`4번. ${quiz.choices[3]}`);
        break;
    }
  }

  const questionTTSPath = `${TTS_MDEIA_BASE_PATH}/question-${quizNumber}.mp3`;
  const questionTTSProjectItem = loadFile(questionTTSPath);
  const questionTTSTrackItem = insertAudioProjectItemIntoSequence(
    sequence,
    questionTTSProjectItem,
    questionTrackItem.start,
    AudioTrackIndex.TTS,
  );
  setVolume(questionTTSTrackItem, 0.31622776389122);

  const timerAndAnswerStartTime = new Time();
  timerAndAnswerStartTime.seconds = questionTTSTrackItem.end.seconds + DELAY_AFTER_QUESTION_SECONDS;

  const answerTrackItem = sequence.importMGT(
    ANSWER_MOGRT_PATH,
    timerAndAnswerStartTime.ticks,
    VideoTrackIndex.ANSWER,
    AudioTrackIndex.DUMMY,
  );

  const answerMogrt = answerTrackItem.getMGTComponent();

  for (let i = 0; i < answerMogrt.properties.numItems; i++) {
    const property = answerMogrt.properties[i];
    switch (property.displayName) {
      case "정답:1":
        property.setValue(`${quiz.answer}번: ${quiz.choices[quiz.answer - 1]}`);
        break;
    }
  }

  const answerTTSPath = `${TTS_MDEIA_BASE_PATH}/answer-${quizNumber}.mp3`;
  const answerTTSProjectItem = loadFile(answerTTSPath);
  const answerTTSStartTime = new Time();
  answerTTSStartTime.seconds = answerTrackItem.start.seconds + 3;
  const answerTTSTrackItem = insertAudioProjectItemIntoSequence(
    sequence,
    answerTTSProjectItem,
    answerTTSStartTime,
    AudioTrackIndex.TTS,
  );
  setVolume(answerTTSTrackItem, 0.31622776389122);

  const quizEndTime = answerTrackItem.end;
  titleTrackItem.end = quizEndTime;
  questionTrackItem.end = quizEndTime;

  return questionTrackItem;
};

export const insertVideoProjectItemIntoSequence = (
  sequence: Sequence,
  projectItem: ProjectItem,
  start: Time,
  trackIndex: number,
): TrackItem => {
  sequence.insertClip(projectItem, start, trackIndex, AudioTrackIndex.DUMMY);

  for (let i = 0; i < sequence.videoTracks[trackIndex].clips.numItems; i++) {
    const item = sequence.videoTracks[trackIndex].clips[i];
    if (item.projectItem.nodeId === projectItem.nodeId) {
      return item;
    }
  }

  throw new Error(`video track(${projectItem.getMediaPath()}) item not found`);
};

const insertAudioProjectItemIntoSequence = (
  sequence: Sequence,
  projectItem: ProjectItem,
  start: Time,
  trackIndex: number,
): TrackItem => {
  sequence.insertClip(projectItem, start, VideoTrackIndex.DUMMY, trackIndex);

  for (let i = 0; i < sequence.audioTracks[trackIndex].clips.numItems; i++) {
    const item = sequence.audioTracks[trackIndex].clips[i];
    if (item.projectItem.nodeId === projectItem.nodeId) {
      return item;
    }
  }

  throw new Error(`audio track(${projectItem.getMediaPath()}) item not found`);
};
