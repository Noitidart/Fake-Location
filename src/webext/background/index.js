import '../common/extension-polyfill'
import { Server as PortsServer } from '../common/comm/webext-ports'
import { callInTemplate } from '../common/comm/comm'
import renderProxiedElement, { Server as ReduxServer } from '../common/comm/redux'

import * as reducers from '../flows'

import BackgroundElement from './BackgroundElement'

const gPortsComm = new PortsServer(exports); // eslint-disable-line no-unused-vars
export const callInPort = callInTemplate.bind(null, gPortsComm, null);
export const callIn = (...args) => new Promise(resolve => exports['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

export const gReduxServer = new ReduxServer(reducers);

// window.addEventListener('unload', function() {
//     console.error('addon shutting down');
// }, false);

renderProxiedElement(gReduxServer, BackgroundElement, document.getElementById('root'), [
    'browser_action',
    'core'
], true)
// .then(unmount => {
//     window.addEventListener('unload', () => {
//         console.error('doing unload from bg');
//         unmount();
//     }, true);
// } ); // to trigger the uninit of FrameScript


export function logIt(what) {
    console.log('what:', what);
}