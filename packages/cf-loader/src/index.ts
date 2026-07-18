/**
 * @agapi/cf-loader — CommandFusion / iViewer GUI runtime.
 *
 * Depends on @agapi/stdlib (net/dgram/http). Host must call installStdlib()
 * before loadProject() if systems need real sockets.
 */

export { parseGUI, parseCSS, parseThemeName, parseGenericNode } from './parser';
export type {
  CFProject,
  CFProperties,
  CFTheme,
  CFPage,
  CFSubpage,
  CFNode,
} from './parser';

export { CFRenderer } from './renderer';
export { CFAPI } from './cf';
export { joinStore, normalizeJoinString } from './joinStore';
export { TokenEngine } from './tokenEngine';
export type { TokenContext } from './tokenEngine';
export { ControlSystem, runMacroByName, stopMacroByName } from './systemManager';

export { loadProject } from './loadProject';
export type { LoadProjectOptions, LoadProjectResult, Orientation } from './loadProject';

export { EVENTS, CONSTANTS } from './jsapi/constants';
export type { CFContext, CFCallback, Watcher } from './jsapi/types';
