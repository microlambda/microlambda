import { Action } from 'redux';

export const UP_ARROW_PRESSED = 'UP_ARROW_PRESSED';
export const DOWN_ARROW_PRESSED = 'DOWN_ARROW_PRESSED';
export const ENTER_PRESSED = 'ENTER_PRESSED';
export const ESCAPE_PRESSED = 'ESCAPE_PRESSED';
export const Q_PRESSED = 'Q_PRESSED';

export const pressArrowUp = (): Action => {
  return { type: UP_ARROW_PRESSED };
};

export const pressArrowDown = (): Action => {
  return { type: DOWN_ARROW_PRESSED };
};

export const pressEnter = (): Action => {
  return { type: ENTER_PRESSED };
};

export const pressEscape = (): Action => {
  return { type: ESCAPE_PRESSED };
};

export const pressQ = (): Action => {
  return { type: Q_PRESSED };
};

/*
https://3cvsjhr0he.execute-api.eu-west-1.amazonaws.com/prod/v4/dashboards/sources/bi-emea-prod-v2/token?group=4e731d62-332a-41e3-957f-1e82551b304f&report=c7082646-a6bd-49b1-b52f-ddbfa40ed9e6&userId=mario.arnautou-ext@pernod-ricard.com&useCube=false&t=1595342043786
https://dashboards.api-dataportal.pernod-ricard.io/v4/dashboards/sources/powerbi-test-cubes/token?group=7fbf1734-a621-4376-b5b7-f86b5e3e591a&report=5ea15014-7554-4032-937a-4edfce12286d&userId=mario.arnautou-ext@pernod-ricard.com&useCube=true&t=1595342124535
 */
