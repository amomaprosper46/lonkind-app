import { EventEmitter } from 'events';

// This is a simple event emitter that will be used to broadcast errors
// from where they are caught to a listener component in the UI.
export const errorEmitter = new EventEmitter();
