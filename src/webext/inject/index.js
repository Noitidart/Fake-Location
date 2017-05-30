/*global config*/

import '../common/extension-polyfill'
// import { Client as PortsClient } from '../common/comm/webext-ports'
// import { callInTemplate } from '../common/comm/comm'

// const gBgComm = new PortsClient(exports, 'frame-script');
// const port = gBgComm.getPort();

// gBgComm.onUnregister.addListener(function() {
//     console.error('frame-script unregistered!!');
// });
// export const callInBackground = callInTemplate.bind(null, gBgComm, null, null); // add to methods so so gFrameComm can call it
// callInBackground('logIt', 'rawwwwrw');
// gBgComm.sendMessage

// function logIt() {
//     port.postMessage('IGNORE');
//     setTimeout(logIt, 1000);
// }
// logIt();

// var config; // << injected

alert('registered');
executeScript({code:'config = ' + JSON.stringify(config)});
executeScript({file:'./injectable/index.bundle.js'});

window.addEventListener('unload', function() {
    console.log('framescript-dying');
}, true);

window.unregister = function() {
    alert('unregistered');
    executeScript({
        code: 'unregister()'
    });
}

window.handleConfigUpdate = function() {
    alert('config updated!');
    executeScript({
        code: `config = ${JSON.stringify(config)}; handleConfigUpdate()`
    });
}

function executeScript({code, file}) {
    const script = document.createElement('script');
    if (code) {
        script.textContent = code;
    } else {
        script.src = extension.extension.getURL(file);
        // TODO: add "script.js" to web_accessible_resources in manifest.json
    }
    script.onload = function() {
        this.remove(); // what does this do??
    };
    (document.head || document.documentElement).appendChild(script);
}