/*global config*/

import fetch from '../common/fetch-polyfill'

alert('registered injectable');
didExtensionShutdown();

window.unregister = function() {
    alert('unregistered injectable');
}


window.handleConfigUpdate = function() {
    alert('config updated! injectable');
}

async function didExtensionShutdown() {
    console.log('ok from here i can test if something shutdown');
    try {
        const res = await fetch(config.war);
        console.log('ext did not shutdown, res:', res);
        setTimeout(didExtensionShutdown, 1000);
    } catch(ex) {
        console.error('ex when try to fetch config.resource:', ex);
        console.log('ext did SHUTDOWN');
        alert('ext shutdown');
    }
}