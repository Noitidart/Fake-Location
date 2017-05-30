alert('registered injectable');

window.unregister = function() {
    alert('unregistered injectable');
}


window.handleConfigUpdate = function() {
    alert('config updated! injectable');
}