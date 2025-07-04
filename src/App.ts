/**
 * App class that represents an entry point of the application.
 */

import { getUUID, getUserSource, getDataFile, assetURL } from './utils/urlUtils';
import { Survey } from './survey/survey';
import { Assessment } from './assessment/assessment';
import { UnityBridge } from './utils/unityBridge';
import { AnalyticsEvents } from './analytics/analyticsEvents';
import { BaseQuiz } from './baseQuiz';
import { fetchAppData, getDataURL, GlobalFlags } from './utils/jsonUtils';
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { Workbox } from 'workbox-window';
import CacheModel from './components/cacheModel';
import { UIController } from './ui/uiController';
import { AndroidBridge } from './utils/androidBridge';

declare const window: any;

const appVersion: string = 'v1.1.3';

/**
 * Content version from the data file in format v0.1
 * Gets set when the content is loaded
 */
let contentVersion: string = '';

let loadingScreen = document.getElementById('loadingScreen');
const progressBar = document.getElementById('progressBar');
const broadcastChannel: BroadcastChannel = new BroadcastChannel('as-message-channel');

// Set up Android-to-JS bridge listener on top level
window.onDataFromAndroid = function (responseJson: string) {
  AndroidBridge._handleDataFromAndroid(responseJson);
};

export class App {
  /** Could be 'assessment' or 'survey' based on the data file */
  public dataURL: string;

  public unityBridge;
  public analytics;
  public game: BaseQuiz;

  cacheModel: CacheModel;

  lang: string = 'english';

  constructor() {
    this.unityBridge = new UnityBridge();


    this.dataURL = getDataFile();
    this.cacheModel = new CacheModel(this.dataURL, this.dataURL, new Set<string>());

    const firebaseConfig = {
      apiKey: 'AIzaSyB8c2lBVi26u7YRL9sxOP97Uaq3yN8hTl4',
      authDomain: 'ftm-b9d99.firebaseapp.com',
      databaseURL: 'https://ftm-b9d99.firebaseio.com',
      projectId: 'ftm-b9d99',
      storageBucket: 'ftm-b9d99.appspot.com',
      messagingSenderId: '602402387941',
      appId: '1:602402387941:web:7b1b1181864d28b49de10c',
      measurementId: 'G-FF1159TGCF',
    };

    const fapp = initializeApp(firebaseConfig);
    const fanalytics = getAnalytics(fapp);

    this.analytics = fanalytics;
    logEvent(fanalytics, 'notification_received');
    logEvent(fanalytics, 'test initialization event', {});
  }

  public async spinUp() {
    window.addEventListener('load', async () => {
      if(GlobalFlags.isRespect) {
          try {
            const data = await AndroidBridge.requestInstalledAppInfo();
            GlobalFlags.isRespect = data.isAppInstalled;
          } catch (err) {
            console.error("Error in installedAppInfo promise:", err);
          }
      }

      (async () => {
        try {
          await fetchAppData(this.dataURL).then((data) => {
            this.cacheModel.setContentFilePath(getDataURL(this.dataURL));

            // TODO: Why do we need to set the feedback text here?
            UIController.SetFeedbackText(data['feedbackText']);

            let appType = data['appType'];
            let assessmentType = data['assessmentType'];

            if (appType == 'survey') {
              this.game = new Survey(this.dataURL, this.unityBridge);
            } else if (appType == 'assessment') {
              // Get and add all the audio assets to the cache model

              let buckets = data['buckets'];

              for (let i = 0; i < buckets.length; i++) {
                for (let j = 0; j < buckets[i].items.length; j++) {
                  let audioItemURL;
                  // Use to lower case for the Lugandan data
                  if (
                    data['quizName'].includes('Luganda') ||
                    data['quizName'].toLowerCase().includes('west african english')
                  ) {
                    audioItemURL = !GlobalFlags.isRespect ?
                      `${assetURL}/` + this.dataURL + '/' + buckets[i].items[j].itemName.toLowerCase().trim() + '.mp3' :
                      '/audio/' + this.dataURL + '/' + buckets[i].items[j].itemName.toLowerCase().trim() + '.mp3';
                  } else {
                    audioItemURL = !GlobalFlags.isRespect ?
                    `${assetURL}/` + this.dataURL + '/' + buckets[i].items[j].itemName.trim() + '.mp3' :
                    '/audio/' + this.dataURL + '/' + buckets[i].items[j].itemName.trim() + '.mp3';
                  }

                  this.cacheModel.addItemToAudioVisualResources(audioItemURL);
                }
              }

              if(!GlobalFlags.isRespect) {
                this.cacheModel.addItemToAudioVisualResources(`${assetURL}/` + this.dataURL + '/answer_feedback.mp3');
                this.cacheModel.addItemToAudioVisualResources('/audioAsset/Correct.wav');
              } else {
                this.cacheModel.addItemToAudioVisualResources('/audio/' + this.dataURL + '/answer_feedback.mp3');
                this.cacheModel.addItemToAudioVisualResources('/audioAsset/Correct.wav');
              }

              this.game = new Assessment(this.dataURL, this.unityBridge);
            }

            this.game.unityBridge = this.unityBridge;

            AnalyticsEvents.setUuid(getUUID(), getUserSource());
            AnalyticsEvents.linkAnalytics(this.analytics, this.dataURL);
            AnalyticsEvents.setAssessmentType(assessmentType);
            contentVersion = data['contentVersion'];
            AnalyticsEvents.sendInit(appVersion, data['contentVersion']);

            if (this.game) {
              this.game.Run(this);
              console.log('Game loaded successfully.');
            }
          });
        } catch (error) {
          console.error('Error loading game:', error);
        }

        // --- Respect mode logic here ---
        if (!GlobalFlags.isRespect) {
          this.simulateFakeCachingProgress(this.lang);
        } else {
          await this.registerServiceWorker(this.game, this.dataURL);
        }
      })();
    });

  }

private simulateFakeCachingProgress(lang: string) {
  const bookName = getDataFile();
  const steps = [25, 50, 75, 100];
  steps.forEach((val, i) => {
    setTimeout(() => {
      handleLoadingMessage({
        data: { progress: val, bookName: bookName }
      }, val);
      if (val === 100) {
        localStorage.setItem(bookName, 'true');
        loadingScreen!.style.display = 'none';
        UIController.SetContentLoaded(true);
      }
    }, i * 700);
  });
}

  async registerServiceWorker(game: BaseQuiz, dataURL: string = '') {
    if ('serviceWorker' in navigator) {
      let wb = new Workbox('./sw.js', {});

      wb.register()
        .then((registration) => {
          this.handleServiceWorkerRegistation(registration);
        })
        .catch((err) => {
        });

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

      await navigator.serviceWorker.ready;

      // We need to check if there's a new version of the content file and in that case
      // remove the localStorage content name and version value

      fetch(this.cacheModel.contentFilePath + '?cache-bust=' + new Date().getTime(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        cache: 'no-store',
      })
        .then(async (response) => {
          if (!response.ok) {
            console.error('Failed to fetch the content file from the server!');
            return;
          }
          const newContentFileData = await response.json();
          const aheadContentVersion = newContentFileData['contentVersion'];

          // We need to check here for the content version updates
          // If there's a new content version, we need to remove the cached content and reload
          // We are comparing here the contentVersion with the aheadContentVersion
          if (aheadContentVersion && contentVersion != aheadContentVersion) {
            localStorage.removeItem(this.cacheModel.appName);
            // Clear the cache for tht particular content
            caches.delete(this.cacheModel.appName);
            handleUpdateFoundMessage();
          }
        })
        .catch((error) => {
          console.error('Error fetching the content file: ' + error);
        });

      if (localStorage.getItem(this.cacheModel.appName) == null) {
        loadingScreen!.style.display = 'flex';
        broadcastChannel.postMessage({
          command: 'Cache',
          data: {
            appData: this.cacheModel,
          },
        });
      } else {
        progressBar!.style.width = 100 + '%';
        setTimeout(() => {
          loadingScreen!.style.display = 'none';
          UIController.SetContentLoaded(true);
        }, 1500);
      }

      broadcastChannel.onmessage = (event) => {
        if (event.data.command == 'Activated' && localStorage.getItem(this.cacheModel.appName) == null) {
          broadcastChannel.postMessage({
            command: 'Cache',
            data: {
              appData: this.cacheModel,
            },
          });
        }
      };
    }
  }

  handleServiceWorkerRegistation(registration: ServiceWorkerRegistration | undefined): void {
    try {
      registration?.installing?.postMessage({
        type: 'Registartion',
        value: this.lang,
      });
    } catch (err) {
    }
  }

  public GetDataURL(): string {
    return this.dataURL;
  }
}

broadcastChannel.addEventListener('message', handleServiceWorkerMessage);

function handleServiceWorkerMessage(event): void {
  if (event.data.msg == 'Loading') {
    let progressValue = parseInt(event.data.data.progress);
    handleLoadingMessage(event, progressValue);
  }
  if (event.data.msg == 'UpdateFound') {
    handleUpdateFoundMessage();
  }
}

function handleLoadingMessage(event, progressValue): void {
  const lessonId = getDataFile();

  const bookName =
    event?.data?.data?.bookName ||
    event?.data?.bookName ||
    event?.bookName ||
    lessonId; // fallback to lessonId

  if (progressValue < 40 && progressValue >= 10) {
    progressBar!.style.width = progressValue + '%';
  } else if (progressValue >= 100) {
    progressBar!.style.width = 100 + '%';
    setTimeout(() => {
      loadingScreen!.style.display = 'none';
      UIController.SetContentLoaded(true);
    }, 1500);
    // add book with a name to local storage as cached
    localStorage.setItem(bookName, 'true');
    readLanguageDataFromCacheAndNotifyAndroidApp(bookName);
  }
}

function readLanguageDataFromCacheAndNotifyAndroidApp(bookName: string) {
  //@ts-ignore
  if (window.Android) {
    let isContentCached: boolean = localStorage.getItem(bookName) !== null;
    //@ts-ignore
    window.Android.cachedStatus(isContentCached);
  }
}

function handleUpdateFoundMessage(): void {
  let text = 'Update Found.\nPlease accept the update by pressing Ok.';
  if (confirm(text) == true) {
    window.location.reload();
  } else {
    text = 'Update will happen on the next launch.';
  }
}

const app = new App();
app.spinUp();
