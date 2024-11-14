import {
  AudioTrackIndex,
  BACKGROUND_IMAGE_PATH,
  ENCODER_PRESET_PATH,
  ENDING_MOGRT_PATH,
  OUTPUT_VIDEO_PATH,
  QUIZZES_JSON_PATH,
  VideoTrackIndex,
} from "./short/constants";
import { addQuiz, createSequence, insertVideoProjectItemIntoSequence, loadFile } from "./helpers";
import { loadQuizzes } from "./utils";

const main = () => {
  $.writeln("Script Start!");

  const QUZZIES = loadQuizzes(QUIZZES_JSON_PATH);

  const sequence = createSequence("sequence");

  const quizTrackItems: Array<TrackItem> = [];
  for (let i = 0; i < QUZZIES.length; i++) {
    const startTicks = i === 0 ? "0" : quizTrackItems[i - 1].end.ticks;
    const trackItem = addQuiz(sequence, QUZZIES[i], (i + 1).toString(), startTicks);
    quizTrackItems.push(trackItem);
  }

  const endingTrackItem = sequence.importMGT(
    ENDING_MOGRT_PATH,
    quizTrackItems[quizTrackItems.length - 1].end.ticks,
    VideoTrackIndex.TITLE,
    AudioTrackIndex.DUMMY,
  );
  const endingEndTime = new Time();
  endingEndTime.seconds = endingTrackItem.start.seconds + 2;
  endingTrackItem.end = endingEndTime;

  const backgroundProjectItem = loadFile(BACKGROUND_IMAGE_PATH);
  const backgroundTrackItem = insertVideoProjectItemIntoSequence(
    sequence,
    backgroundProjectItem,
    new Time(),
    VideoTrackIndex.BACKGROUND,
  );
  const backgroundEndTime = new Time();
  backgroundEndTime.seconds = endingTrackItem.end.seconds;
  backgroundTrackItem.end = backgroundEndTime;

  app.encoder.launchEncoder();
  app.encoder.encodeSequence(sequence, OUTPUT_VIDEO_PATH, ENCODER_PRESET_PATH, 0, 1);
  app.encoder.startBatch();

  $.writeln("Script Done!");
};

main();
