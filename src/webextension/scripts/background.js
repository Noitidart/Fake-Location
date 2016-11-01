var nub  = {
	self: {
		id: chrome.runtime.id,
		version: chrome.runtime.getManifest().version,
		chromemanifestkey: 'fake-location'
	},
	browser: {
		name: getBrowser().name,
		version: getBrowser().version
	},
	path: {
		// webext relative paths
		images: 'images/',
		fonts: 'styles/fonts/',
		pages: 'pages/',
		scripts: 'scripts/',
		styles: 'styles/',
		// non-webext paths - SPECIAL prefixed with underscore - means it is from chrome://nub.addon.id/content/
		// _exe: 'exe/',
		// chrome path versions set after this block
		chrome: {}
	},
	// nativemessaging: { // only used by firefox
	// 	manifest_json: {
	// 	  name: 'profilist', // i use this as child entry for windows registry entry, so make sure this name is compatible with injection into windows registry link39191
	// 	  description: 'Platform helper for Profilist',
	// 	  path: undefined, // set by `getNativeMessagingInfo` in bootstrap
	// 	  type: 'stdio',
	// 	  allowed_extensions: [ chrome.runtime.id ]
	// 	}
	// },
	store: {
		// defaults - keys that present in here during `preinit` are fetched on startup
			// 3 types
				// prefs are prefeixed with "pref_"
				// mem are prefeixed with "mem_" - mem stands for extension specific "cookies"/"system memory"
				// filesystem-like stuff is prefixied with "fs_"
		mem_lastversion: '-1' // indicates not installed - the "last installed version"
	}
};

// set chrome:// paths in nub.path
for (var pathkey in nub.path) {
	if (pathkey == 'chrome') continue;
	var prefix = 'chrome://' + nub.self.chromemanifestkey + '/content/';
	var suffix;
	if (pathkey[0] == '_') pathkey = pathkey.substr(1);
	if (nub.path['_' + pathkey]) {
		// its a chrome path only
		suffix = nub.path['_' + pathkey];
	} else {
		suffix = 'webextension/' + nub.path[pathkey];
	}
	nub.path.chrome[pathkey] = prefix + suffix;
}

var gExeComm;
var gPortsComm = new Comm.server.webextports();
var gBsComm = new Comm.client.webext();

var callInAPort = Comm.callInX2.bind(null, gPortsComm, null);
// var callInExe = Comm.callInX2.bind(null, 'gExeComm', null, null); // cannot use `gExeComm` it must be `"gExeComm"` as string because `gExeComm` var was not yet assigned
var callInBootstrap = Comm.callInX2.bind(null, gBsComm, null, null);
// var callInMainworker = Comm.callInX2.bind(null, gBsComm, 'callInMainworker', null);

// start - init
preinit();

// never retries - only one special case of retry is after auto install native messaging
function preinit(aIsRetry) {

	var promiseallarr = [];
	/*
	 promises in promiseallarr when get rejected, reject with:
		{
			reason: string;enum[STORE_CONNECT, EXE_CONNECT, EXE_MISMATCH]
			text: string - non-localized associated text to show - NOT formated text. this is something i would insert into the template shown
			data: object - only if EXE_MISMATCH - keys: exeversion
		}
	*/
	// give bootstrap nub
	callInBootstrap('sendNub', { nub:nub });

	// fetch storage
	promiseallarr.push(new Promise(function(resolve, reject) {
		storageCall('local', 'get', Object.keys(nub.store))
		.then(function(storeds) {
			for (var key in storeds) {
				nub.store[key] = storeds[key];
			}
			resolve();
		})
		.catch(function(err) {
			reject(err);
		});
	}));

	// get platform info - and startup exe (desktop) or mainworker (android)
	promiseallarr.push(new Promise(function(resolve, reject) {
		// start async-proc133934
		var getPlat = function() {
			chrome.runtime.getPlatformInfo(gotPlat);
		};

		var gotPlat = function(platinfo) {
			console.log('platinfo:', platinfo);
			nub.platform = platinfo;

			resolve('ok platinfo got')
			// startNativeHost();
		};

		// var startNativeHost = function() {
		// 	if (nub.platform.os == 'android') {
		// 		callInBootstrap('startupMainworker', { path:'chrome://profilist/content/webextension/scripts/mainworker.js' });
		// 		// worker doesnt start till first call, so just assume it connected
		// 		verifyNativeHost();
		// 	} else {
		// 		gExeComm = new Comm.server.webextexe(
		// 			'profilist',
		// 			function() {
		// 				// exe connected
		// 				verifyNativeHost();
		// 			},
		// 			function(aErr) {
		// 				// exe failed to connect
		// 				console.error('failed to connect to exe, aErr:', aErr);
		// 				if (aErr) aErr = aErr.toString(); // because at the time of me writing this, Comm::webext.js does not give an error reason fail, i tried but i couldnt get the error reason, it is only logged to console
		// 				verifyNativeHost({ reason:'EXE_CONNECT', text:aErr });
		// 			}
		// 		);
		// 	}
		// };
		//
		// var verifyNativeHost = function(aRejectObj) {
		// 	// last step of async-proc - responsible for calling `resolve` or `reject`
		// 	console.log('in verifyNativeHost');
		// 	if (aRejectObj) {
		// 		reject(aRejectObj);
		// 	} else {
		// 		// verifies the native host version matches that of the extension
		// 		if (nub.platform.os == 'android') {
		// 			resolve('ok platinfo got AND nativehost (mainworker) started up');
		// 		} else {
		// 			callInExe('getExeVersion', undefined, function(exeversion) {
		// 				var extversion = nub.self.version;
		// 				if (exeversion === extversion) {
		// 					resolve('ok platinfo got AND exe started up AND exe version matches extension version');
		// 				} else {
		// 					reject({ reason:'EXE_MISMATCH', data:{ exeversion:exeversion } });
		// 				}
		// 			});
		// 		}
		// 	}
		// };

		getPlat();
		// end async-proc133934
	}));

	Promise.all(promiseallarr)
	.then(function(valarr) {
		console.log('valarr:', valarr);
		// ok `preinit` completed successfully
		init();
	})
	.catch(function onPreinitFailed(err) {
		console.error('onPreinitFailed, err:', err);
		// start sync-proc39
		var shouldRetry = function() {
			if (aIsRetry) {
				// do not retry again, even if it was for another reason - i only do 1 retry
				displayError();
			} else {
				switch (err.reason) {
					// case 'EXE_CONNECT':
					// case 'EXE_MISMATCH':
					// 		if (nub.browser.name == 'Firefox')
					// 			doRetry();
					// 		else
					// 			displayError();
					// 	break;
					default:
						displayError();
				}
			}
		};

		var doRetry = function() {
			// if (err.reason.indexOf('EXE_') === 0) {
			// 	callInBootstrap('installNativeMessaging', { nativemessaging:nub.nativemessaging, path:nub.path }, function(aInstallFailed) {
			// 		if (!aInstallFailed)
			// 			setTimeout(preinit.bind(null, true), 0); // so it gets out of this catch scope
			// 		else
			// 			displayError(aInstallFailed);
			// 	});
			// }
		};

		var displayError = function(errex) {
			// last step

			// build body, based on err.reason, with localized template and with err.text and errex
			var body, bodyarr;
			switch (err.reason) {
				// case 'STORE_CONNECT': // let default handler take care of this
				// 		//
				// 	break;
				// case 'EXE_CONNECT':
				//
				// 		bodyarr = [chrome.i18n.getMessage('startupfailed_execonnect') + ' ' + (err.text || chrome.i18n.getMessage('startupfailed_unknown'))]
				// 		if (errex) bodyarr[0] += ' ' + errex.toString();
				//
				// 	break;
				// case 'EXE_MISMATCH':
				//
				// 		// build howtofixstr
				// 		var extversion = nub.self.version;
				// 		var exeversion = err.data.exeversion;
				// 		console.log('going to isSemVer', extversion, exeversion);
				// 		console.log('semver:', isSemVer(extversion, '>' + exeversion));
				// 		var howtofixstr = isSemVer(extversion, '>' + exeversion) ? chrome.i18n.getMessage('startupfailed_exemismatch_howtofix1') : chrome.i18n.getMessage('startupfailed_exemismatch_howtofix2');
				// 		bodyarr = [ chrome.i18n.getMessage('startupfailed_exemismatch', [exeversion, extversion, howtofixstr]) ];
				// 		if (errex) bodyarr[0] += ' ' + errex.toString();
				//
				// 	break;
				default:
					var txt = '';
					if (err && err.text) txt += err.text;
					if (txt && errex) txt += '\n';
					if (errex) txt += errex;

					bodyarr = [ txt || chrome.i18n.getMessage('startupfailed_unknown') ];
			}
			var body = chrome.i18n.getMessage('startupfailed_body', bodyarr);

			// show error to user
			callInBootstrap('showSystemAlert', { title:chrome.i18n.getMessage('startupfailed_title'), body:body });
		};

		shouldRetry();
		// end sync-proc39
	});
}

function init() {
	// after receiving nub
	console.log('in init, nub:', nub);

	startupBrowserAction();

	var lastversion = nub.store.mem_lastversion;
	if (lastversion === '-1') {
		// installed / first run
		console.error('FIRST RUN');
		storageCall('local', 'set', { mem_lastversion:nub.self.version }).then(a=>console.log('set, nub.store:', nub.store));
	} else if (lastversion !== nub.self.version) {
		// downgrade or upgrade
		if (isSemVer(nub.self.version, '>' + lastversion)) {
			// upgrade
			console.error('UPDGRADE');
		} else {
			// downgrade
			console.error('DOWNGRADE');
		}
		storageCall('local', 'set', { mem_lastversion:nub.self.version }).then(a=>console.log('set, nub.store:', nub.store));
	} // else if (lastversion === nub.self.version) { } // browser startup OR enabled after having disabled
}

function uninit() {
	// from IRC on 093016 - no need to unregister these ports, they are done for me on addon sutdown
	// gPortsComm.unregister();
	// gExeComm.unregister();
}
// end - init

// start - browseraction
function startupBrowserAction() {
	// browser_action/chrome.browserAction is not supported on Android, so tell bootstrap to inject action item to NativeWindow.menu
	if (nub.platform.os == 'android') {
		callInBootstrap('startupAndroid', {
			browseraction: {
				title: chrome.i18n.getMessage('browseraction_title'),
				iconpath: chrome.runtime.getURL('images/icon.svg')
			}
		});
	} else {
		chrome.browserAction.onClicked.addListener(onBrowserActionClicked);
	}
}
function onBrowserActionClicked() {
	console.log('opening menu.html now');
	addTab(nub.path.pages + 'app.html');
}
// end - browseraction

async function fetchData(aArg={}) {
	let { hydrant, nub } = aArg;

	let data = {};

	let basketmain = new PromiseBasket;

	if (nub) data.nub = nub;

	if (hydrant) {
		if (hydrant.store) {
			basketmain.add(
				storageCall('local', 'get', Object.keys(hydrant.store)),
				storeds => data.store = storeds
			);
		}
	}

	await basketmain.run();

	return data;
}

class PromiseBasket {
	constructor() {
		this.promises = [];
		this.thens = [];
	}
	add(aAsync, onThen) {
		// onThen is optional
		this.promises.push(aAsync);
		this.thens.push(onThen);
	}
	async run() {
		let results = await Promise.all(this.promises);
		results.forEach((r, i)=>this.thens[i] ? this.thens[i](r) : null);
		return results;
	}
}

// start - polyfill for android
function addTab(url) {
	if (chrome.tabs && chrome.tabs.create) {
		chrome.tabs.create({ url:url });
	} else {
		// its android
		callInBootstrap('addTab', { url:url });
	}
}
function reuseElseAddTab(url) {
	// find tab by url, if it exists focus its window and tab and the reuse it. else add tab
}
// end - polyfill for android

// start - cmn
// rev2 - https://gist.github.com/Noitidart/bcb964207ac370d3301720f3d5c9eb2b
var _storagecall_pendingset = {};
var _storagecall_callid = 1;
function storageCall(aArea, aAction, aKeys, aOptions) {
	if (typeof(aArea) == 'object') ({ aArea, aAction, aKeys, aOptions } = aArea);
	// because storage can fail, i created this, which goes until it doesnt fail

	// aAction - string;enum[set,get,clear,remove]
	// aKeys -
		// if aAction "clear" then ignore
		// if aAction "remove" then string/string[]
		// if aAction "get" then null/string/string[]
		// if aAction "set" then object
	// aOptions - object
		// maxtries - int;default:0 - set to 0 if you want it to try infinitely
		// timebetween - int;default:50 - milliseconds

	aOptions = aOptions ? aOptions : {};
	const maxtries = aOptions.maxtries || 0;
	const timebetween = aOptions.timebetween || 50;

	const callid = _storagecall_callid++; // the id of this call to `storageCall` // only used for when `aAction` is "set"

	if (aAction == 'set') {
		// see if still trying to set any of these keys
		for (var setkey in aKeys) {
			_storagecall_pendingset[setkey] = callid;
		}
	}
	return new Promise(function(resolve, reject) {
		// start asnc-proc49399
		var trycnt = 0;

		var call = function() {
			switch (aAction) {
				case 'clear':
						chrome.storage[aArea][aAction](check);
					break;
				case 'set':
						// special processing
						// start - block-link3191
						// make sure that each this `callid` is still responsible for setting in `aKeys`
						for (var setkey in aKeys) {
							if (_storagecall_pendingset[setkey] !== callid) {
								delete aKeys[setkey];
							}
						}
						// end - block-link3191
						if (!Object.keys(aKeys).length) resolve(); // no longer responsible, as another call to set - with the keys that this callid was responsible for - has been made, so lets say it succeeded // i `resolve` and not `reject` because, say i was still responsible for one of the keys, when that completes it will `resolve`
						else chrome.storage[aArea][aAction](aKeys, check);
					break;
				default:
					chrome.storage[aArea][aAction](aKeys, check);
			}
		};

		var check = function(arg1) {
			if (chrome.runtime.lastError) {
				if (!maxtries || trycnt++ < maxtries) setTimeout(call, timebetween);
				else reject(chrome.runtime.lastError); // `maxtries` reached
			} else {
				switch (aAction) {
					case 'clear':
					case 'remove':
							// callback `check` triggred with no arguments
							resolve();
					case 'set':
							// callback `check` triggred with no arguments - BUT special processing

							// race condition I THINK - because i think setting storage internals is async - so what if another call came in and did the set while this one was in between `call` and `check`, so meaningi t was processing - and then this finished processing AFTER a new call to `storageCall('', 'set'` happend
							// copy - block-link3191
							// make sure that each this `callid` is still responsible for setting in `aKeys`
							for (var setkey in aKeys) {
								if (_storagecall_pendingset[setkey] !== callid) {
									delete aKeys[setkey];
								}
							}
							// end copy - block-link3191

							// remove keys from `_storagecall_pendingset`
							for (var setkey in aKeys) {
								// assuming _storagecall_pendingset[setkey] === callid
								delete _storagecall_pendingset[setkey];
							}

							// SPECIAL - udpate nub.store
							if (typeof(nub) == 'object' && nub.store) {
								for (var setkey in aKeys) {
									nub.store[setkey] = aKeys[setkey];
								}
							}

							resolve(aKeys);
						break;
					case 'get':
							// callback `check` triggred with 1 argument
							var storeds = arg1;
							resolve(storeds);
						break;
				}
				resolve(storeds);
			}
		};

		call();
		// end asnc-proc49399
	});
}

// rev2 - https://gist.github.com/Noitidart/59ee6c306fa493a4f35fb122bcf13e99
function getBrowser() {
	function getBrowserInner() {
		// http://stackoverflow.com/a/2401861/1828637
	    var ua= navigator.userAgent, tem,
	    M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
	    if(/trident/i.test(M[1])){
	        tem=  /\brv[ :]+(\d+)/g.exec(ua) || [];
	        return 'IE '+(tem[1] || '');
	    }
	    if(M[1]=== 'Chrome'){
	        tem= ua.match(/\b(OPR|Edge)\/(\d+)/);
	        if(tem!= null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
	    }
	    M= M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
	    if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
	    return M.join(' ');
	}

	var name_version_str = getBrowserInner();
	var split = name_version_str.split(' ');
	var version = split.pop();
	var name = split.join(' ');
	return {
		name: name,
		version: version
	};
}
// end - cmn
