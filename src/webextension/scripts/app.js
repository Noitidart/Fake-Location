let gBgComm = new Comm.client.webextports('tab');
var callInBackground = Comm.callInX2.bind(null, gBgComm, null, null);
var callInExe = Comm.callInX2.bind(null, gBgComm, 'callInExe', null);
var callInBootstrap = Comm.callInX2.bind(null, gBgComm, 'callInBootstrap', null);
var callInMainworker = Comm.callInX2.bind(null, gBgComm, 'callInMainworker', null);
let callIn = (...args) => new Promise(resolve => window['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

alert('hi');

// start - specific helpers
function genFilename() {
	// salt generator from http://mxr.mozilla.org/mozilla-aurora/source/toolkit/profile/content/createProfileWizard.js?raw=1*/

	var mozKSaltTable = [
		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
		'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		'1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
	];

	var kSaltString = '';
	for (var i = 0; i < 8; ++i) {
		kSaltString += mozKSaltTable[Math.floor(Math.random() * mozKSaltTable.length)];
	}
	return kSaltString;
	// return kSaltString + '.' + aName;
}

function getFormValues(domids) {
	// let domids = ['name', 'description', 'code'];
	let processors = {group:parseInt} // custom for Trigger
	let domvalues = {};
	for (let domid of domids) {
		let domvalue = document.getElementById(domid).value.trim();
		let processor = processors[domid];
		if (processor) domvalue = processor(domvalue);
		domvalues[domid] = domvalue;
	}
	return domvalues;
}

const origStopClickAndCheck0 = stopClickAndCheck0;
stopClickAndCheck0 = function(e) {
	// let target = e.target;
	// setTimeout(()=>target.blur());
	setTimeout(()=>document.activeElement.blur(), 0);
	return origStopClickAndCheck0(e);
}
function allowDownAndCheck0(e) {
	if (!e) return true;

	// e.stopPropagation();
	// e.preventDefault();
  setTimeout(()=>document.activeElement.blur(), 0);
	return e.button === 0 ? true : false;
}
function messageDownReactMarkup(str) {
    // takes a string 'Hi <B>rawr</B>!' and returns a bolded react element in the middle
    return (
        str
        .split(/<\/?b>/i)
        .map((el, i) => {
            if (i % 2) {
                return React.createElement('b', undefined, el);
            } else {
                return el;
            }
        })
        .filter(el => typeof(el) != 'string' ? true : el.length)
    );
}
// end - specific helpers
