import { store } from '../state/store';
import { pressArrowDown, pressArrowUp, pressEscape } from '../state/actions/user-input';
import { Key } from 'ink';

export const handleUserInput = (input: string, key: Key) => {
  if (input === 'q') {
    // TODO: graceful shutdown
  }

  if (input === 'l') {
    // TODO: graceful shutdown
  }

  if (input === 's') {
    // TODO: graceful shutdown
  }

  if (input === 'r') {
    // TODO: graceful shutdown
  }

  if (input === 'b') {
    // TODO: graceful shutdown
  }

  if (input === 'e') {
    // TODO: graceful shutdown
  }

  if (input === 'd') {
    // TODO: graceful shutdown
  }

  if (input === 't') {
    // TODO: graceful shutdown
  }
  if (input === 'p') {
    // TODO: graceful shutdown
  }
  if (input === '$') {
    // TODO: graceful shutdown
  }

  if (key.escape) {
    store.dispatch(pressEscape());
  }

  if (key.upArrow) {
    store.dispatch(pressArrowUp());
  }

  if (key.downArrow) {
    store.dispatch(pressArrowDown());
  }
};
