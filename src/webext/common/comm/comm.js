const deepAccessUsingString = (obj, dotpath) => dotpath.split('.').reduce((nested, key) => nested[key], obj);

class Base {
    // private - set by constructor - i do modify constructor lots of times, so this may be of interest
    target = null
    scope = null
    onHandshake = undefined
    // private to comm - even extenders dont touch this
    receptacle = {}
    nextcbid = 1
    isunregistered = false
    // config - extenders should touch these, otherwise they default to what is here
    multiclient = false // short for multiclient_server
    cantransfer = false
    commname = 'Unnamed'
    constructor(aTarget, aMethods, onHandshake) {
        // aTarget - is like window or worker or frame etc - the thing we postMessage on
        // aMethods - object of methods
        this.target = aTarget;
        this.scope = aMethods;
        if (onHandshake) {
            this.onHandshake = () => {
                this.onHandshake = null;
                onHandshake();
            }
        }
    }
    getControllerPayload(message) { // ...args
        // if webext-ports args are message, port, sendResponse
        // if frame then args are are e - so `return e.data`
        let payload = message;
        return payload;
    }
    getControllerReportProgress(payload) { // payload, ..args
        let { cbid } = payload;
        return this.reportProgress.bind({ THIS:this, cbid });
    }
    // related two methods
    doSendMessageMethod(aTransfers, payload) { // aTransfers, payload, aClientId
        // crossfile-link183848 - IMPORTAANT: the third arg is what defines what aClientId should be. so it defines "argument signature" of sendMessage. And getControllSendMessageArgs should return an array that matches this signature link6775492!!!
        // this.cantransfer is just a helper so that if message method is postMessage, then dever can just set that rather then override doSendMessageMethod
        if (this.cantransfer && aTransfers) {
            this.target.postMessage(payload, aTransfers);
        } else {
            console.log(`Comm.${this.commname} - in doSendMessageMethod, payload:`, payload, 'target:', this.target);
            this.target.postMessage(payload);
        }
    }
    // getControllerSendMessageArgs is dicated by doSendMessageMethod
    getControllerSendMessageArgs(val, payload) { // val, payload, ...args
        // ...args is the args that come to controller
        // must retrun array of arguments that this.sendMessage expects. what it expects is based on this.multiclient
        // val is message to send - aArg
        // aMethod = cbid
        let { cbid } = payload;
        return [ cbid, val ];
    }
    // reportProgress should this.sendMessage with degined/expected/signatured-above ...restargs
    reportProgess(aProgressArg) { // always gets manually .bind'ed
        // NOTE: aProgressArg must be an object! so dever using this must know that to report progress they must pass an object!
        let { THIS, cbid } = this;
        aProgressArg.__PROGRESS = 1;
        THIS.sendMessage(cbid, aProgressArg);
    }
    // end related two methods
    unregister() {
        if (this.isunregistered) throw new Error(`Comm.${this.commname} - already unregistered`);
        this.isunregistered = true;
    }
    // onUnregister = {
    //     handlers: [],
    //     addListener: function(handler) {
    //         // returns true if added, else false if already there
    //         if (!this.handlers.includes(handler)) {
    //             this.handlers.push(handler);
    //             return true;
    //         }
    //         return false;
    //     },
    //     removeListener: function(handler) {
    //         // returns true if removed, else false if it was never there
    //         let ix = this.handlers.indexOf(handler);
    //         if (ix > -1) {
    //             this.handlers.splice(ix, 1);
    //             return true;
    //         }
    //         return false;
    //     }
    // }
    // private - to comm - extenders dont touch this
    sendMessage = (...args) => {
        let aClientId, aMethod, aArg, aCallback;
        if (this.multiclient) {
            [aClientId, aMethod, aArg, aCallback] = args;
        } else {
            [aMethod, aArg, aCallback] = args;
        }
        let aTransfers;
        if (this.cantransfer) {
            if (aArg && aArg.__XFER) {
                // if want to transfer stuff aArg MUST be an object, with a key __XFER holding the keys that should be transferred
                // __XFER is either array or object. if array it is strings of the keys that should be transferred. if object, the keys should be names of the keys to transfer and values can be anything
                aTransfers = [];
                let { __XFER } = aArg;
                // __XFER must be array or object
                if (Array.isArray(__XFER)) {
                    for (let xferdata of __XFER) {
                        aTransfers.push(xferdata);
                    }
                } else {
                    // assume its an object
                    if (!isObject(__XFER)) throw new Error('__XFER must be Array or Object!');
                    for (let [, xferdata] of Object.entries(__XFER)) {
                        aTransfers.push(xferdata);
                    }
                }
            }
        }

        let cbid = null;
        if (typeof aMethod === 'number') {
            // this is a response to a callack waiting in framescript
            cbid = aMethod;
            aMethod = null;
        } else {
            if (aCallback) {
                cbid = this.nextcbid++;
                this.receptacle[cbid] = aCallback;
            }
        }

        let payload = {
            method: aMethod,
            arg: aArg,
            cbid: cbid
        };

        this.doSendMessageMethod(aTransfers, payload, aClientId);
    }
    controller = async (...args) => {
        let payload = this.getControllerPayload(...args);
        console.log(`Comm.${this.commname} - incoming, payload:`, payload)

        if (payload.method) {
            if (payload.method === '__HANDSHAKE__') {
                if (this.onHandshake) this.onHandshake();
                return;
            }

            // let methodref =  deepAccessUsingString(this.scope, payload.method);
            let mdotpath = payload.method.split('.'); // method_dotpath
            if (!deepAccessUsingString(this.scope, payload.method)) {
                throw new Error(`Comm.${this.commname} method of "${payload.method}" not in scope`);
            }

            let rez_scope;
            switch (mdotpath.length) {
                case 1:
                        rez_scope = this.scope[payload.method](payload.arg, payload.cbid ? this.getControllerReportProgress(payload, ...args) : undefined, this);
                    break;
                case 2:
                        rez_scope = this.scope[mdotpath[0]][mdotpath[1]](payload.arg, payload.cbid ? this.getControllerReportProgress(payload, ...args) : undefined, this);
                    break;
                default:
                    throw new Error(`mdotpath length of "${mdotpath.length}" not supported, manually add it here`);
            }
            // in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
            if (payload.cbid) {
                let val = await Promise.resolve(rez_scope);
                this.sendMessage(...this.getControllerSendMessageArgs(val, payload, ...args));
            }
        } else if (!payload.method && payload.cbid) {
            // its a cbid
            this.receptacle[payload.cbid](payload.arg, this);
            if (payload.arg && !payload.arg.__PROGRESS) {
                delete this.receptacle[payload.cbid];
            }
        }
        else console.error(`Comm.${this.commname} - invalid combination. method:`, payload.method, 'cbid:', payload.cbid, 'payload:', payload);
    }
}

export function callInTemplate(aCommTo, aCallInMethod, aMessageManagerOrTabId, aMethod, aArg, aCallback) {
    // MUST not be used directly, MUSt have aCommTo and aCallInMethod bounded
    // aCommTo - is either the Comm instance, or a function that on exec gets the Comm instance
    aCommTo = typeof aCommTo === 'function' ? aCommTo() : aCommTo;
    let { sendMessage } = aCommTo;
    if (aMessageManagerOrTabId) sendMessage = sendMessage.bind(aCommTo, aMessageManagerOrTabId);

    if (isObject(aMethod)) {
        var aReportProgress = aArg;
        // var aCommFrom = aCallback; // i dont use it, but it is correct
        ({m:aMethod, a:aArg} = aMethod);
        if (!aCallInMethod) {
            if (aReportProgress) { // if it has aReportProgress then the scope has a callback waiting for reply
                return new Promise(resolve => {
                    sendMessage(aMethod, aArg, rez => {
                        if (rez && rez.__PROGRESS) {
                            aReportProgress(rez);
                        } else {
                            resolve(rez);
                        }
                    });
                });
            } else {
                sendMessage(aMethod, aArg);
            }
        } else {
            if (aReportProgress) { // if it has aReportProgress then the scope has a callback waiting for reply
                return new Promise(resolve => {
                    sendMessage(aCallInMethod, { m:aMethod, a:aArg }, rez => {
                        if (rez && rez.__PROGRESS) {
                            aReportProgress(rez);
                        } else {
                            resolve(rez);
                        }
                    });
                });
            } else {
                sendMessage(aCallInMethod, { m:aMethod, a:aArg });
            }
        }
    } else {
        if (!aCallInMethod) {
            sendMessage(aMethod, aArg, aCallback);
        } else {
            sendMessage(aCallInMethod, { m:aMethod, a:aArg }, aCallback);
        }
    }
}

export function isObject(avar) {
    // cosntructor.name tested for `function Animal(){}; var a = new Animal(); isObject(a);` will return true otherwise as it is [Object object]
    return Object.prototype.toString.call(avar) === '[object Object]' && avar.constructor.name === 'Object';
}

export default Base