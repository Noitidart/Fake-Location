import Base, { isObject } from './comm'

/*
RULES
* Handshake triggers first client side
* onHandshake has no arguments on Server nor Client side
* Earliest time can do callIn
  * Server - soon after new Server() - the call will trigger AFTER Client.onHandshake obviously as thats where port is connected. in my tests the callIn fired BEFORE Server.onHandshake
  * Client - in onHandshake
* Soonest can do new FrameServer - must add iframe.addEventListener('load') and do it in the callback
* Can do new FrameClient right away
*/

export class Server extends Base {
    // base config
    cantransfer = true
    commname = 'Frame.Server'
    constructor(aTarget, aMethods, onHandshake) {
        // aTarget is window of frame
        // real target, is what communication is done on, and its port1
        let framewindow = aTarget;

        let { port2, port1 } = new MessageChannel();
        aTarget = port1;
        super(aTarget, aMethods, onHandshake);

        aTarget.onmessage = this.controller;

        framewindow.postMessage({
            topic: '__PRIVATE_HANDSHAKE__',
            port2
        }, '*', [port2]);
    }
    getControllerPayload(e) {
        return e.data;
    }
    // TODO: in unregister, maybe tell connected child frame to unregister?
}

export class Client extends Base {
    // base config
    cantransfer = true
    commname = 'Frame.Client'
    constructor(aMethods, onHandshake) {
        // aTarget is null right now, it will be the received port2 in this.handshaker
        let aTarget = null;
        super(aTarget, aMethods, onHandshake);
        window.addEventListener('message', this.handshaker, false);
    }
    getControllerPayload(e) {
        return e.data;
    }
    unregister() {
        super.unregister();
        window.removeEventListener('message', this.handshaker, false); // in case urnegister while it is still attached
    }
    handshaker = e => {
        let data = e.data;
        console.log(`Comm.${this.commname} - incoming window message, data:`, data);
        if (data && isObject(data)) {
            switch (data.topic) {
                case '__PRIVATE_HANDSHAKE__':
                    console.log(`Comm.${this.commname} - in handshake`);
                    window.removeEventListener('message', this.handshaker, false);
                    this.target = data.port2;
                    this.target.onmessage = this.controller;
                    this.sendMessage('__HANDSHAKE__');
                    if (this.onHandshake) this.onHandshake();
                // no default
            }
        }
    }
}