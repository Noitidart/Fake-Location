navigator.geolocation.getCurrentPosition = function(onSuccess, onError, options) {
    function Coordinates(options) {
        var defaults = {latitude:0, longitude:0, altitude:null, accuracy:4000, altitudeAccuracy:null, heading:NaN, speed:NaN};
        for (var param in defaults) {
            this[param] = options[param] !== undefined ? options[param] : defaults[param];
        }
    }
    function Position(params) {
        this.coords = new Coordinates(params);
        this.timestamp = Date.now();
    }

    let pos = new Position({latitude:4, longitude:1});

    onSuccess(pos);
};

var HACKED_GEO_WATCH_ID = 0;
var HACKED_GEO_WATCHERS = {};
navigator.geolocation.watchPosition = function(onSuccess, onError, options) {
    function Coordinates(options) {
        var defaults = {latitude:0, longitude:0, altitude:null, accuracy:4000, altitudeAccuracy:null, heading:NaN, speed:NaN};
        for (var param in defaults) {
            this[param] = options[param] !== undefined ? options[param] : defaults[param];
        }
    }
    function Position(params) {
        this.coords = new Coordinates(params);
        this.timestamp = Date.now();
    }

    let pos = new Position({latitude:4, longitude:1});


    var id = HACKED_GEO_WATCH_ID++
    HACKED_GEO_WATCHERS[id.toString()] = onSuccess;

    setTimeout(function(){onSuccess(pos)}, 0);
    // setTimeout of 0 because in my tests it seemed this would come in after id is logged first, my test:
        // var id = navigator.geolocation.watchPosition(pos => console.log(pos));
        // console.log('id:', id)

    return id;
};

navigator.geolocation.clearWatch = function(id) {
    delete HACKED_GEO_WATCHERS[id.toString()];
}