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

export function getDataFile(): string {
  const pathParams = getPathName();
  var data = pathParams.get('lesson_id');
  if (data == undefined) {
    data = 'zulu-lettersounds';
    //data = "survey-zulu";
  }
  return data;
}

function getPathName() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  return urlParams;
}
