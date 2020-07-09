import { Action } from 'redux';

export const UP_ARROW_PRESSED = 'UP_ARROW_PRESSED';
export const DOWN_ARROW_PRESSED = 'DOWN_ARROW_PRESSED';
export const ENTER_PRESSED = 'ENTER_PRESSED';
export const ESCAPE_PRESSED = 'ESCAPE_PRESSED';

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
