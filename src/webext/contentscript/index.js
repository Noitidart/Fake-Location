import { Client as FrameClient } from '../common/comm/frame'
import { callInTemplate } from '../common/comm/comm'

const gParentFrameComm = new FrameClient(exports, handleHandshake);
export const callInBackground = callInTemplate.bind(null, gParentFrameComm, 'callInBackground', null);
export const callIn = (...args) => new Promise(resolve => exports['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

function component () {
  var element = document.createElement('div');

  /* lodash is required for the next line to work */
  element.innerHTML = ['hi from appframe'].join(' ');

  return element;
}

// callInBackground('logit', 'logging it from appframe!'); // will not work, must wait for handshake - otherwise get - TypeError: this.target is null[Learn More] - which makes sense, i dont set this.target until after handshake
function handleHandshake() {
    console.log('Frame.Client - handhsake in client side is done');
    callInBackground('logit', 'logging it from appframe!');
}

export function text(str) {
    console.error('setting text content, this happens before Server.onHandshake but after Client.onHandshake, str:', str);
    document.getElementById('root').textContent = str;
}

document.body.appendChild(component());
