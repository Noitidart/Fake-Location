import '../common/extension-polyfill'

import { Client as PortsClient } from '../common/comm/webext-ports'
import { Server as FrameServer } from '../common/comm/frame' // eslint-disable-line no-unused-vars
import { callInTemplate } from '../common/comm/comm'

import renderProxiedElement from '../common/comm/redux'
import AppElement from './AppElement'

import './index.css'

const gBgComm = new PortsClient(exports, 'app');
let gFrameComm;
export const callInBackground = callInTemplate.bind(null, gBgComm, null, null); // add to methods so so gFrameComm can call it
export const callInFrame = callInTemplate.bind(null, ()=>gFrameComm, null, null); // i add it to methods so background can call into frame
export const callIn = (...args) => new Promise(resolve => exports['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

window.callInBackground = callInBackground;

// function addChildFrame() {
//     const iframe = document.createElement('iframe');
//     iframe.addEventListener('load', handleChildframeLoad, false); // cannot use DOMContentLoaded as that is a document event - http://stackoverflow.com/a/24621957/1828637
//     iframe.src = 'appframe.html';

//     document.body.appendChild(iframe);
// }

// function handleChildframeLoad(e) {
//     let frame = e.target;
//     frame.removeEventListener('load', handleChildframeLoad, false);
//     console.log('childframe loaded!');
//     gFrameComm = new FrameServer(frame.contentWindow, exports, ()=>console.log('Frame.Server handshake in server side is done')); // eslint-disable-line no-unused-vars

//     callInFrame('text', 'rawwwwwwwr');
// }

///////////////////
// let unmountApp;
renderProxiedElement([callInBackground, 'gReduxServer'], AppElement, document.getElementById('root'), [
    'core',
    'filter',
    'todos'
]);
// ]).then(unmountProxiedElement => unmountApp = unmountProxiedElement);