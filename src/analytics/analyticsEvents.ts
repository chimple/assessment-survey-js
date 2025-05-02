// this is where we can have the classes and functions for building the events
// to send to an analytics recorder (firebase? lrs?)

import { qData, answerData } from '../components/questionData';
import { logEvent } from 'firebase/analytics';
import { bucket } from '../assessment/bucketData';
import { AndroidBridge, LevelCompletedEvent } from '../utils/androidBridge';
import { MathUtils } from '../utils/mathUtils';

// Create a singleton class for the analytics events
export class AnalyticsEvents {
  protected static uuid: string;
  protected static userSource: string;
  protected static clat;
  protected static clon;
  protected static gana;
  protected static latlong;
  // var city, region, country;
  protected static dataURL;

  protected static appVersion;
  protected static contentVersion;

  protected static assessmentType: string;

  static instance: AnalyticsEvents;

  private constructor() {
    // Initialize the class
  }

  static getInstance(): AnalyticsEvents {
    if (!AnalyticsEvents.instance) {
      AnalyticsEvents.instance = new AnalyticsEvents();
    }

    return AnalyticsEvents.instance;
  }

  static setAssessmentType(assessmentType: string): void {
    AnalyticsEvents.assessmentType = assessmentType;
  }

  // Get Location
  static getLocation(): void {
    console.log('starting to get location');
    fetch(`https://ipinfo.io/json?token=b6268727178610`)
      .then((response) => {
        console.log('got location response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then((jsonResponse) => {
        console.log(jsonResponse);
        AnalyticsEvents.latlong = jsonResponse.loc;
        var lpieces = AnalyticsEvents.latlong.split(',');
        var lat = parseFloat(lpieces[0]).toFixed(2);
        var lon = parseFloat(lpieces[1]).toFixed(1);
        AnalyticsEvents.clat = lat;
        AnalyticsEvents.clon = lon;
        AnalyticsEvents.latlong = '';
        lpieces = [];
        // city = jsonResponse.city;
        // region = jsonResponse.region;
        // country = jsonResponse.country;
        AnalyticsEvents.sendLocation();

        return {};
      })
      .catch((err) => {
        console.warn(`location failed to update! encountered error ${err.msg}`);
      });
  }

  // Link Analytics
  static linkAnalytics(newgana, dataurl): void {
    AnalyticsEvents.gana = newgana;
    AnalyticsEvents.dataURL = dataurl;
  }

  // Set UUID
  static setUuid(newUuid: string, newUserSource: string): void {
    AnalyticsEvents.uuid = newUuid;
    AnalyticsEvents.userSource = newUserSource;
  }

  // Send Init
  static sendInit(appVersion: string, contentVersion: string): void {
    AnalyticsEvents.appVersion = appVersion;
    AnalyticsEvents.contentVersion = contentVersion;

    AnalyticsEvents.getLocation();

    var eventString = 'user ' + AnalyticsEvents.uuid + ' opened the assessment';

    console.log(eventString);

    logEvent(AnalyticsEvents.gana, 'opened', {});
  }

  // Get App Language From Data URL
  static getAppLanguageFromDataURL(appType: string): string {
    // Check if app type is not empty and split the string by the hyphen then return the first element
    if (appType && appType !== '' && appType.includes('-')) {
      let language: string = appType.split('-').slice(0, -1).join('-');
      if (language.includes('west-african')) {
        return 'west-african-english';
      } else {
        return language;
      }
    }

    return 'NotAvailable';
  }

  // Get App Type From Data URL
  static getAppTypeFromDataURL(appType: string): string {
    // Check if app type is not empty and split the string by the hyphen then return the last element
    if (appType && appType !== '' && appType.includes('-')) {
      return appType.substring(appType.lastIndexOf('-') + 1);
    }

    return 'NotAvailable';
  }

  // Send Location
  static sendLocation(): void {
    var eventString =
      'Sending User coordinates: ' + AnalyticsEvents.uuid + ' : ' + AnalyticsEvents.clat + ', ' + AnalyticsEvents.clon;
    console.log(eventString);

    logEvent(AnalyticsEvents.gana, 'user_location', {
      user: AnalyticsEvents.uuid,
      lang: AnalyticsEvents.getAppLanguageFromDataURL(AnalyticsEvents.dataURL),
      app: AnalyticsEvents.getAppTypeFromDataURL(AnalyticsEvents.dataURL),
      latlong: AnalyticsEvents.joinLatLong(AnalyticsEvents.clat, AnalyticsEvents.clon),
    });

    console.log('INITIALIZED EVENT SENT');
    console.log('App Language: ' + AnalyticsEvents.getAppLanguageFromDataURL(AnalyticsEvents.dataURL));
    console.log('App Type: ' + AnalyticsEvents.getAppTypeFromDataURL(AnalyticsEvents.dataURL));
    console.log('App Version: ' + AnalyticsEvents.appVersion);
    console.log('Content Version: ' + AnalyticsEvents.contentVersion);

    logEvent(AnalyticsEvents.gana, 'initialized', {
      type: 'initialized',
      clUserId: AnalyticsEvents.uuid,
      userSource: AnalyticsEvents.userSource,
      latLong: AnalyticsEvents.joinLatLong(AnalyticsEvents.clat, AnalyticsEvents.clon),
      appVersion: AnalyticsEvents.appVersion,
      contentVersion: AnalyticsEvents.contentVersion,
      // city: city,
      // region: region,
      // country: country,
      app: AnalyticsEvents.getAppTypeFromDataURL(AnalyticsEvents.dataURL),
      lang: AnalyticsEvents.getAppLanguageFromDataURL(AnalyticsEvents.dataURL),
    });
  }

  // Send Answered
  static sendAnswered(theQ: qData, theA: number, elapsed: number): void {
    var ans = theQ.answers[theA - 1];

    var iscorrect = null;
    var bucket = null;
    if ('correct' in theQ) {
      if (theQ.correct != null) {
        if (theQ.correct == ans.answerName) {
          iscorrect = true;
        } else {
          iscorrect = false;
        }
      }
    }
    if ('bucket' in theQ) {
      bucket = theQ.bucket;
    }
    var eventString = 'user ' + AnalyticsEvents.uuid + ' answered ' + theQ.qName + ' with ' + ans.answerName;
    eventString += ', all answers were [';
    var opts = '';
    for (var aNum in theQ.answers) {
      eventString += theQ.answers[aNum].answerName + ',';
      opts += theQ.answers[aNum].answerName + ',';
    }
    eventString += '] ';
    eventString += iscorrect;
    eventString += bucket;
    console.log(eventString);
    console.log('Answered App Version: ' + AnalyticsEvents.appVersion);
    console.log('Content Version: ' + AnalyticsEvents.contentVersion);

    logEvent(AnalyticsEvents.gana, 'answered', {
      type: 'answered',
      clUserId: AnalyticsEvents.uuid,
      userSource: AnalyticsEvents.userSource,
      latLong: AnalyticsEvents.joinLatLong(AnalyticsEvents.clat, AnalyticsEvents.clon),
      // city: city,
      // region: region,
      // country: country,
      app: AnalyticsEvents.getAppTypeFromDataURL(AnalyticsEvents.dataURL),
      lang: AnalyticsEvents.getAppLanguageFromDataURL(AnalyticsEvents.dataURL),
      dt: elapsed,
      question_number: theQ.qNumber,
      target: theQ.qTarget,
      question: theQ.promptText,
      selected_answer: ans.answerName,
      iscorrect: iscorrect,
      options: opts,
      bucket: bucket,
      appVersion: AnalyticsEvents.appVersion,
      contentVersion: AnalyticsEvents.contentVersion,
    });
  }

  // Send Bucket
  static sendBucket(tb: bucket, passed: boolean): void {
    var bn = tb.bucketID;
    var btried = tb.numTried;
    var bcorrect = tb.numCorrect;

    var eventString =
      'user ' +
      AnalyticsEvents.uuid +
      ' finished the bucket ' +
      bn +
      ' with ' +
      bcorrect +
      ' correct answers out of ' +
      btried +
      ' tried' +
      ' and passed: ' +
      passed;
    console.log(eventString);
    console.log('Bucket Completed App Version: ' + AnalyticsEvents.appVersion);
    console.log('Content Version: ' + AnalyticsEvents.contentVersion);

    logEvent(AnalyticsEvents.gana, 'bucketCompleted', {
      type: 'bucketCompleted',
      clUserId: AnalyticsEvents.uuid,
      userSource: AnalyticsEvents.userSource,
      latLong: AnalyticsEvents.joinLatLong(AnalyticsEvents.clat, AnalyticsEvents.clon),
      // city: city,
      // region: region,
      // country: country,
      app: AnalyticsEvents.getAppTypeFromDataURL(AnalyticsEvents.dataURL),
      lang: AnalyticsEvents.getAppLanguageFromDataURL(AnalyticsEvents.dataURL),
      bucketNumber: bn,
      numberTriedInBucket: btried,
      numberCorrectInBucket: bcorrect,
      passedBucket: passed,
      appVersion: AnalyticsEvents.appVersion,
      contentVersion: AnalyticsEvents.contentVersion,
    });
  }

  // Send Finished
  static sendFinished(buckets: bucket[] = null, basalBucket: number, ceilingBucket: number): void {
    let eventString = 'user ' + AnalyticsEvents.uuid + ' finished the assessment';
    console.log(eventString);

    let basalBucketID = AnalyticsEvents.getBasalBucketID(buckets);
    let ceilingBucketID = AnalyticsEvents.getCeilingBucketID(buckets);

    if (basalBucketID == 0) {
      basalBucketID = ceilingBucketID;
    }

    let score = AnalyticsEvents.calculateScore(buckets, basalBucketID);
    const maxScore = buckets.length * 100;

    console.log('Sending completed event');
    console.log('Score: ' + score);
    console.log('Max Score: ' + maxScore);
    console.log('Basal Bucket: ' + basalBucketID);
    console.log('BASAL FROM ASSESSMENT: ' + basalBucket);
    console.log('Ceiling Bucket: ' + ceilingBucketID);
    console.log('CEILING FROM ASSESSMENT: ' + ceilingBucket);
    console.log('Completed App Version: ' + AnalyticsEvents.appVersion);
    console.log('Content Version: ' + AnalyticsEvents.contentVersion);

    console.log('MathUtils.wrongMove: ' + MathUtils.wrongMove);
    console.log('MathUtils.correctMove: ' + MathUtils.correctMove);
    console.log("MathUtils.duration: " , Date.now() - MathUtils.duration);
    const lessonName = AnalyticsEvents.getAppTypeFromDataURL(AnalyticsEvents.dataURL);
    const lessonScore = MathUtils.calculateScore();


    const levelCompletedData: LevelCompletedEvent = {
      right_moves: MathUtils.wrongMove,
      wrong_moves: MathUtils.correctMove,
      success_or_failure: lessonScore > 35 ? "success" : "failure",
      level_number: lessonName,
      number_of_successful_puzzles: 0,
      duration: (Date.now() - MathUtils.duration) / 1000,
      score: lessonScore
    };

    AndroidBridge.sendDataToContainer("gameData", levelCompletedData);
    console.log("Sent level completed data to container:", levelCompletedData);
    
    AnalyticsEvents.sendDataToThirdParty(score, AnalyticsEvents.uuid);

    // Attempt to send the score to the parent curious frame if it exists
    if (window.parent) {
      window.parent.postMessage(
        {
          type: 'assessment_completed',
          score: score,
          // maxScore: maxScore,
          // basalBucket: basalBucketID,
          // ceilingBucket: ceilingBucketID,
          // appVersion: AnalyticsEvents.appVersion,
          // contentVersion: AnalyticsEvents.contentVersion,
        },
        'https://synapse.curiouscontent.org/'
      );
    }

    logEvent(AnalyticsEvents.gana, 'completed', {
      type: 'completed',
      clUserId: AnalyticsEvents.uuid,
      userSource: AnalyticsEvents.userSource,
      app: AnalyticsEvents.getAppTypeFromDataURL(AnalyticsEvents.dataURL),
      lang: AnalyticsEvents.getAppLanguageFromDataURL(AnalyticsEvents.dataURL),
      latLong: AnalyticsEvents.joinLatLong(AnalyticsEvents.clat, AnalyticsEvents.clon),
      // city: city,
      // region: region,
      // country: country,
      score: score,
      maxScore: maxScore,
      basalBucket: basalBucketID,
      ceilingBucket: ceilingBucketID,
      appVersion: AnalyticsEvents.appVersion,
      contentVersion: AnalyticsEvents.contentVersion,
    });
  }

  static sendDataToThirdParty(score: number, uuid: string): void {
    // Send data to the third party
    console.log('Attempting to send score to a third party! Score: ', score);

    // Read the URL from utm parameters
    const urlParams = new URLSearchParams(window.location.search);
    const targetPartyURL = urlParams.get('endpoint');
    const organization = urlParams.get('organization');
    const xhr = new XMLHttpRequest();

    if (!targetPartyURL) {
      console.error('No target party URL found!');
      return;
    }

    const payload = {
      user: uuid,
      page: '111108121363615',
      event: {
        type: 'external',
        value: {
          type: 'assessment',
          subType: AnalyticsEvents.assessmentType,
          score: score,
          completed: true,
        },
      },
    };

    const payloadString = JSON.stringify(payload);

    try {
      xhr.open('POST', targetPartyURL, true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Request was successful, handle the response here
          console.log('POST success!' + xhr.responseText);
        } else {
          // Request failed
          console.error('Request failed with status: ' + xhr.status);
        }
      };

      xhr.send(payloadString);
    } catch (error) {
      console.error('Failed to send data to target party: ', error);
    }
  }

  // Calculate Score
  static calculateScore(buckets: bucket[], basalBucketID: number): number {
    console.log('Calculating score');
    console.log(buckets);

    let score = 0;

    console.log('Basal Bucket ID: ' + basalBucketID);

    // Get the numcorrect from the basal bucket based on looping through and finding the bucket id
    let numCorrect = 0;

    for (const index in buckets) {
      const bucket = buckets[index];
      if (bucket.bucketID == basalBucketID) {
        numCorrect = bucket.numCorrect;
        break;
      }
    }

    console.log('Num Correct: ' + numCorrect, ' basal: ' + basalBucketID, ' buckets: ' + buckets.length);

    if (basalBucketID === buckets.length && numCorrect >= 4) {
      // If the user has enough correct answers in the last bucket, give them a perfect score
      console.log('Perfect score');

      return buckets.length * 100;
    }

    score = Math.round((basalBucketID - 1) * 100 + (numCorrect / 5) * 100) | 0;

    return score;
  }

  // Get Basal Bucket ID
  static getBasalBucketID(buckets: bucket[]): number {
    let bucketID = 0;

    // Select the lowest bucketID bucket that the user has failed
    for (const index in buckets) {
      const bucket = buckets[index];
      if (bucket.tested && !bucket.passed) {
        if (bucketID == 0 || bucket.bucketID < bucketID) {
          bucketID = bucket.bucketID;
        }
      }
    }

    return bucketID;
  }

  // Get Ceiling Bucket ID
  static getCeilingBucketID(buckets: bucket[]): number {
    let bucketID = 0;

    // Select the hiughest bucketID bucket that the user has passed
    for (const index in buckets) {
      const bucket = buckets[index];
      if (bucket.tested && bucket.passed) {
        if (bucketID == 0 || bucket.bucketID > bucketID) {
          bucketID = bucket.bucketID;
        }
      }
    }

    return bucketID;
  }

  // Join Lat Long
  static joinLatLong(lat: string, lon: string): string {
    return lat + ',' + lon;
  }
}
