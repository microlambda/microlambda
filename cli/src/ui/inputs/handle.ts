import { store } from '../state/store';
import { pressArrowDown, pressArrowUp, pressEscape, pressQ } from '../state/actions/user-input';
import { Key } from 'ink';

export const handleUserInput = (input: string, key: Key): void => {
  if (key.escape) {
    store.dispatch(pressEscape());
    return;
  }

  if (key.upArrow) {
    store.dispatch(pressArrowUp());
    return;
  }

  if (key.downArrow) {
    store.dispatch(pressArrowDown());
    return;
  }

  if (key.ctrl && input === 'c') {
    store.dispatch(pressQ());
    return;
  }

  switch (input) {
    case 'q':
      store.dispatch(pressQ());
      return;
    case 'l':
    case 's':
    case 'r':
    case 'b':
    case 'e':
    case 'd':
    case 't':
    case 'p':
    case '$':
    default:
      return;
  }
};
