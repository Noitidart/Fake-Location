import '../common/extension-polyfill'

var config; // << injected

alert('registered');
executeScript({
    file:'./injectable/index.bundle.js'
});

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