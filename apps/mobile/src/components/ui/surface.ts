import { createContext } from 'react';

// True inside a card, sheet or dialog. Error words there are --ink beside the --err icon,
// because --err on --raise is below 4.5 to 1 in dark (2.7).
export const RaisedSurface = createContext(false);
