import '../common/extension-polyfill'

import { Client as PortsClient } from '../common/comm/webext-ports'
import { callInTemplate } from '../common/comm/comm'

import renderProxiedElement from '../common/comm/redux'
import ContentScriptElement from './ContentScriptElement'

let gBgComm;
export const callInBackground = callInTemplate.bind(null, () => gBgComm, null, null); // add to methods so so gFrameComm can call it
export const callIn = (...args) => new Promise(resolve => exports['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

function waitOldBuildUnmount(cb) {
    const root_old = document.getElementById('~ADDON_ID~');
    if (root_old) {
        setTimeout(waitOldBuildUnmount, 100);
    } else {
        // ok old version was removed, lets add in this version now
        const root = document.createElement('div');
        root.setAttribute('id', '~ADDON_ID~');
        document.body.insertBefore(root, document.body.firstChild);
        cb();
    }
}

function init() {
    console.log('will gBgComm now');
    gBgComm = new PortsClient(exports, 'content');
    console.log('will render proxied element now');
    waitOldBuildUnmount(() => {
        renderProxiedElement([callInBackground, 'gReduxServer'], ContentScriptElement, document.getElementById('~ADDON_ID~'), [
            'core',
            'filter'
        ]);
    });
}

setTimeout(init, 1000); // 1s delay because i need backgroudn ports server to startup in background AND i think in firefox the content script is loading before the background script MAYYYYBE