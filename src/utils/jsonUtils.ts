/** Json Utils */

// import { setFeedbackText } from './uiController';
import { getDataFile } from './urlUtils';
import { assetURL } from './urlUtils';

export const GlobalFlags = {
  isRespect: false,
};

export async function fetchAppData(url: string) {
  if (!GlobalFlags.isRespect) {
    const lessonId = getDataFile();
    const furl = !GlobalFlags.isRespect ? `${assetURL}/${lessonId}/${lessonId}.json` : `/data/${lessonId}.json`;
    return fetch(furl).then((response) => response.json());
  }
  return loadData(url).then((data) => data);
}

export async function fetchAppType(url: string) {
  return loadData(url).then((data) => {
    // setFeedbackText(data["feedbackText"]);
    return data['appType'];
  });
}

export async function fetchFeedback(url: string) {
  return loadData(url).then((data) => {
    return data['feedbackText'];
  });
}

export async function fetchSurveyQuestions(url: string) {
  return loadData(url).then((data) => {
    return data['questions'];
  });
}

export async function fetchAssessmentBuckets(url: string) {
  return loadData(url).then((data) => {
    return data['buckets'];
  });
}

export function getDataURL(url: string) {
  return !GlobalFlags.isRespect ? `${assetURL}/${url}/` + url + '.json' : '/data/' + url + '.json';
}

export function getCaseIndependentLangList() {
  return ['luganda'];
}

async function loadData(url: string) {
  var furl = getDataURL(url);
  return fetch(furl).then((response) => response.json());
}
