import '../common/extension-polyfill'

import { Client as PortsClient } from '../common/comm/webext-ports'
import { callInTemplate } from '../common/comm/comm'

import renderProxiedElement from '../common/comm/redux'
import AppElement from './AppElement'

import './index.css'

const gBgComm = new PortsClient(exports, 'app');
export const callInBackground = callInTemplate.bind(null, gBgComm, null, null); // add to methods so so gFrameComm can call it
export const callIn = (...args) => new Promise(resolve => exports['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

// window.callInBackground = callInBackground;

///////////////////
// let unmountApp;
renderProxiedElement([callInBackground, 'gReduxServer'], AppElement, document.getElementById('root'), [
    'core',
    'filter',
    'todos'
]);
// ]).then(unmountProxiedElement => unmountApp = unmountProxiedElement);