import '../common/extension-polyfill'

import { Client as PortsClient } from '../common/comm/webext-ports'
import { callInTemplate } from '../common/comm/comm'

// import renderProxiedElement from '../common/comm/redux'
// import ContentScriptElement from './ContentScriptElement'

const gBgComm = new PortsClient(exports, 'contentscript');
export const callInBackground = callInTemplate.bind(null, gBgComm, null, null); // add to methods so so gFrameComm can call it
export const callIn = (...args) => new Promise(resolve => exports['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

gBgComm.onUnregister.addListener(function() {
    alert('unregistered!');
});

callInBackground('logIt', 'hiiiiiii fromt cs');

setTimeout(function() {
    callInBackground('logIt', 'AGAIN hiiiiiii fromt cs');
}, 5000);

const div = document.createElement('div');
div.textContent = 'adsfasdfsadf ' + new Date().toLocaleTimeString();
document.body.insertBefore(div, document.body.firstChild);

///////////////////
// const root = document.createElement('div');
// document.body.insertBefore(root, document.body.firstChild);
// renderProxiedElement([callInBackground, 'gReduxServer'], ContentScriptElement, root, [
//     'core'
// ]);