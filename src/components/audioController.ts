//code for loading audios

import { qData } from './questionData';
import { bucket, bucketItem } from '../assessment/bucketData';
import { getCaseIndependentLangList, GlobalFlags } from '../utils/jsonUtils';
import { assetURL } from '../utils/urlUtils';

export class AudioController {
  private static instance: AudioController | null = null;

  public imageToCache: string[] = [];
  public wavToCache: string[] = [];

  public allAudios: any = {};
  public allImages: any = {};
  public dataURL: string = '';

  private correctSoundPath = 'audioAsset/Correct.wav';

  private feedbackAudio: any = null;
  private correctAudio: any = null;

  private init(): void {
    this.feedbackAudio = new Audio();
    this.feedbackAudio.src = this.correctSoundPath;
    this.correctAudio = new Audio();
  }

  public static PrepareAudioAndImagesForSurvey(questionsData: qData[], dataURL: string): void {
    AudioController.getInstance().dataURL = dataURL;

    const feedbackSoundPath = !GlobalFlags.isRespect ?
    `${assetURL}/` + AudioController.getInstance().dataURL + '/answer_feedback.mp3' :
    'audio/' + AudioController.getInstance().dataURL + '/answer_feedback.mp3';

    AudioController.getInstance().wavToCache.push(feedbackSoundPath);
    AudioController.getInstance().correctAudio.src = feedbackSoundPath;

    for (var questionIndex in questionsData) {
      let questionData = questionsData[questionIndex];
      if (questionData.promptAudio != null) {
        AudioController.FilterAndAddAudioToAllAudios(questionData.promptAudio.toLowerCase());
      }

      if (questionData.promptImg != null) {
        AudioController.AddImageToAllImages(questionData.promptImg);
      }

      for (var answerIndex in questionData.answers) {
        let answerData = questionData.answers[answerIndex];
        if (answerData.answerImg != null) {
          AudioController.AddImageToAllImages(answerData.answerImg);
        }
      }
    }
  }

  public static AddImageToAllImages(newImageURL: string): void {
    let newImage = new Image();
    newImage.src = newImageURL;
    AudioController.getInstance().allImages[newImageURL] = newImage;
  }

  public static FilterAndAddAudioToAllAudios(newAudioURL: string): void {
    if (newAudioURL.includes('.wav')) {
      newAudioURL = newAudioURL.replace('.wav', '.mp3');
    } else if (newAudioURL.includes('.mp3')) {
      // Already contains .mp3 not doing anything
    } else {
      newAudioURL = newAudioURL.trim() + '.mp3';
    }

    let newAudio = new Audio();
    if (getCaseIndependentLangList().includes(AudioController.getInstance().dataURL.split('-')[0])) {
      newAudio.src = !GlobalFlags.isRespect ?
      `${assetURL}/` + AudioController.getInstance().dataURL + '/' + newAudioURL :
      'audio/' + AudioController.getInstance().dataURL + '/' + newAudioURL;
    } else {
      newAudio.src = !GlobalFlags.isRespect ?
      `${assetURL}/` + AudioController.getInstance().dataURL + '/' + newAudioURL :
      'audio/' + AudioController.getInstance().dataURL + '/' + newAudioURL;
    }

    AudioController.getInstance().allAudios[newAudioURL] = newAudio;
  }

  public static PreloadBucket(newBucket: bucket, dataURL) {
    AudioController.getInstance().dataURL = dataURL;
    AudioController.getInstance().correctAudio.src = !GlobalFlags.isRespect ?
      `${assetURL}/` + AudioController.getInstance().dataURL + '/answer_feedback.mp3' :
      'audio/' + AudioController.getInstance().dataURL + '/answer_feedback.mp3';
    for (var itemIndex in newBucket.items) {
      var item = newBucket.items[itemIndex];
      AudioController.FilterAndAddAudioToAllAudios(item.itemName.toLowerCase());
    }
  }

  public static PlayAudio(audioName: string, finishedCallback?: Function, audioAnim?: Function): void {
    audioName = audioName.toLowerCase();
    if (audioName.includes('.mp3')) {
      if (audioName.slice(-4) != '.mp3') {
        audioName = audioName.trim() + '.mp3';
      }
    } else {
      audioName = audioName.trim() + '.mp3';
    }

    const playPromise = new Promise<void>((resolve, reject) => {
      const audio = AudioController.getInstance().allAudios[audioName];
      if (audio) {
        audio.addEventListener('play', () => {
          typeof audioAnim !== 'undefined' ? audioAnim(true) : null;
        });

        audio.addEventListener('ended', () => {
          typeof audioAnim !== 'undefined' ? audioAnim(false) : null;
          resolve();
        });

        audio.play().catch((error) => {
          console.error('Error playing audio:', error);
          resolve();
        });
      } else {
        console.warn('Audio file not found:', audioName);
        resolve();
      }
    });

    playPromise
      .then(() => {
        typeof finishedCallback !== 'undefined' ? finishedCallback() : null;
      })
      .catch((error) => {
        console.error('Promise error:', error);
      });
  }

  public static GetImage(imageName: string): any {
    return AudioController.getInstance().allImages[imageName];
  }

  public static PlayDing(): void {
    AudioController.getInstance().feedbackAudio.play();
  }

  public static PlayCorrect(): void {
    AudioController.getInstance().correctAudio.play();
  }

  public static getInstance(): AudioController {
    if (AudioController.instance == null) {
      AudioController.instance = new AudioController();
      AudioController.instance.init();
    }

    return AudioController.instance;
  }
}
