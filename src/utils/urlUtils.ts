/**
 * Contains utils for working with URL strings.
 */

export const assetURL = "https://curious-reader.web.app/web-apps/assessment";

export function getAppType(): string {
  const pathParams = getPathName();
  const appType = pathParams.get('appType');
  return appType;
}

export function getUUID(): string {
  const pathParams = getPathName();
  var nuuid = pathParams.get('cr_user_id');
  if (nuuid == undefined) {
    nuuid = 'WebUserNoID';
  }
  return nuuid;
}

export function getUserSource(): string {
  const pathParams = getPathName();
  var nuuid = pathParams.get('userSource');
  if (nuuid == undefined) {
    nuuid = 'WebUserNoSource';
  }
  return nuuid;
}

const validLessons = [
  'bangla-lettersounds',
  'bangla-sightwords',
  'french-lettersounds',
  'french-sightwords',
  'hausa-lettersounds',
  'hausa-sightwords',
  'hindi-lettersounds',
  'luganda-lettersounds',
  'nepalese-lettersounds',
  'pashto-lettersounds',
  'survey-zulu',
  'ukrainian-lettersounds',
  'west-african-english-lettersounds',
  'west-african-sightwords',
  'zulu-lettersounds'
];

export function getDataFile(): string {
  const pathParams = getPathName();
  var data = pathParams.get('lesson_id') != null ? pathParams.get('lesson_id').toLowerCase() : null;
  if (data && validLessons.includes(data)) {
    return data;
  }
  return 'zulu-lettersounds';
}

function getPathName() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  return urlParams;
}
