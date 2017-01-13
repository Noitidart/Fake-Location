var nub = {
	self: {
		id: chrome.runtime.id,
		version: chrome.runtime.getManifest().version,
		chromemanifestkey: '{{CHROMEMANIFESTKEY}}', // crossfile-link37388
		// startup_reason: string; enum[STARTUP, UPGRADE, DOWNGRADE, INSTALL]
		// old_version: set only on UPGRADE/DOWNGRADE
        fatal: undefined // set to error when fatal startup happens
	},
	browser: {
		name: getBrowser().name.toLowerCase(),
		version: getBrowser().version
	},
	path: {
		// webext relative paths
		webext: '/',
		images: 'images/',
		fonts: 'styles/fonts/',
		locales: '_locales/',
		pages: 'pages/',
		scripts: 'scripts/',
		styles: 'styles/',
		exe: 'exe/',
		// chrome path versions set after this block
		chrome: {
			// non-webext paths - SPECIAL prefixed with underscore - means it is from chrome://nub.addon.id/content/
			// all the relatives from above will come in here as well, prefixed with chrome://nub.addon.id/content/
			// only: 'only', // will me prefixed with chrome://nub.addon.id/content/
		}
	},
	namsg: { // only used by firefox
		manifest: {
			name: 'trigger', // this is also the exe filename // i use this as child entry for windows registry entry, so make sure this name is compatible with injection into windows registry link39191
			description: 'Platform helper for Trigger',
			path: undefined, // set by `getNativeMessagingInfo` in bootstrap
			type: 'stdio',
			allowed_extensions: [ chrome.runtime.id ]
		}
	},
	stg: {
		// defaults - keys that present in here during `preinit` are fetched on startup and maintained whenever `storageCall` with `set` is done
			// 3 types
				// prefs are prefeixed with "pref_"
				// mem are prefeixed with "mem_" - mem stands for extension specific "cookies"/"system memory"
				// filesystem-like stuff is prefixied with "fs_"
		mem_lastversion: '-1', // indicates not installed - the "last installed version"
		pref_geo: {}
	}
};
formatNubPaths();

var gExeComm;
var gPortsComm = new Comm.server.webextports();
var gBsComm = new Comm.client.webext();

var callInAPort = Comm.callInX2.bind(null, gPortsComm, null);
var callInExe = Comm.callInX2.bind(null, 'gExeComm', null, null); // cannot use `gExeComm` it must be `"gExeComm"` as string because `gExeComm` var was not yet assigned
var callInBootstrap = Comm.callInX2.bind(null, gBsComm, null, null);
var callInMainworker = Comm.callInX2.bind(null, gBsComm, 'callInMainworker', null);
var callInNative; // set in preinit, if its android, it is eqaul to callInMainworker, else it is equal to callInExe
let callIn = (...args) => new Promise(resolve => window['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

var gExtLocale;

// start - init
let gStartupLoaderDots = 0;
let gStartupLoaderDotsMax = 3;
let gStartupLoaderInterval = 350;
function startupLoaderAnimation() {
    if (nub.self.fatal === undefined) {
        if (gStartupLoaderDots++ === gStartupLoaderDotsMax) {
            gStartupLoaderDots = 1;
        }

        setBrowserAction({
            text: '.'.repeat(gStartupLoaderDots) + ' '.repeat(gStartupLoaderDotsMax - gStartupLoaderDots),
            color:'#7DCE8D'
        });
        setTimeout(startupLoaderAnimation, gStartupLoaderInterval);
    } else if (nub.self.fatal === null) {
        setBrowserAction({ text:'' });
    }
}
async function preinit() {

    startupLoaderAnimation();
    browser.browserAction.onClicked.addListener(onBrowserActionClicked);

	let basketmain = new PromiseBasket;
    let steps = {
        done: [],
        failed: [],
        inprog: [],
        pending: [
            'locale',
            'storage',
            'platform_info'
            // 'platform_setup',
            // 'platform_init'
        ],
    };
    steps.total_cnt = steps.pending.length;


    let startStep = stepname => {
        let ixpend = steps.pending.indexOf(stepname);
        if (ixpend === -1) console.error('DEV ERROR: no such pending stepname:', stepname);
        steps.pending.splice(ixpend, 1);
        steps.inprog.push(stepname);
        // if (!nub.self.fatal) setBrowserAction({ text:browser.i18n.getMessage('initializing_step', [steps.done.length, steps.total_cnt]), color:'#F57C00' });
    };
    let errorStep = stepname => {
        if (stepname) {
            let ixprog = steps.inprog.indexOf(stepname);
            if (ixprog > -1) steps.inprog.splice(ixprog, 1);
            steps.failed.push(stepname);
        }
        setBrowserAction({ text:browser.i18n.getMessage('badge_error'), color:'#E51C23' });
    };
    let finishStep = stepname => {
        let ixprog = steps.inprog.indexOf(stepname);
        if (ixprog === -1) console.error('DEV ERROR: no such inprog stepname:', stepname);
        steps.inprog.splice(ixprog, 1);
        steps.done.push(stepname);

        steps.done.push(stepname);

        // not making these seteps responsible for browser action as it is now just dots
        // if (!nub.self.fatal) {
        //     // is either undefined for steps in progress, or null for complete link847473
        //     if (steps.done.length === steps.total_cnt) {
        //         setBrowserAction({ text:'' });
        //     } else {
        //         // setBrowserAction({ text:browser.i18n.getMessage('initializing_step', [steps.done.length, steps.total_cnt]), color:'#F57C00' });
        //         // setBrowserAction({ text:browser.i18n.getMessage('badge_startingup'), color:'#F57C00' });
        //     }
        // }
    };

	/*
	 promises in promiseallarr when get rejected, reject with:
		{
			reason: string;enum[STG_CONNECT, EXE_CONNECT, EXE_MISMATCH]
			text: string - non-localized associated text to show - NOT formated text. this is something i would insert into the template shown
			data: object - only if EXE_MISMATCH - keys: exeversion
		}
	*/
    // get ext locale
    basketmain.add(
        async function() {
            const stepname = 'locale';
            startStep(stepname);
            gExtLocale = await getSelectedLocale('addon_desc');
            console.log('gExtLocale:', gExtLocale);
        }(),
        () => finishStep('locale')
    );

	// fetch storage - set nub.self.startup_reason and nub.self.old_version
	basketmain.add(
		async function() {
			// fetch storage and set always update values (keys in nub.stg)
            const stepname = 'storage';
            startStep(stepname);
			try {
				let stgeds = await storageCall('local', 'get', Object.keys(nub.stg));
				for (let key in stgeds) {
					nub.stg[key] = stgeds[key];
				}
			} catch(err) {
				throw { stepname, reason:'STG_CONNECT', text:err.toString() };
			}

			// set nub.self.startup_reason and old_version
			let lastversion = nub.stg.mem_lastversion;
			if (lastversion === '-1') {
				// installed / first run
				nub.self.startup_reason = 'INSTALL';
				storageCall('local', 'set', { mem_lastversion:nub.self.version })
				.then(a=>console.log('set, nub.stg:', nub.stg));
			} else if (lastversion !== nub.self.version) {
				// downgrade or upgrade
				if (isSemVer(nub.self.version, '>' + lastversion)) {
					// upgrade
					nub.self.startup_reason = 'UPGRADE';
				} else {
					// downgrade
					nub.self.startup_reason = 'DOWNGRADE';
				}
				nub.self.old_version = lastversion;
				storageCall('local', 'set', { mem_lastversion:nub.self.version })
				.then(a=>console.log('set, nub.stg:', nub.stg));
			} else {
				// lastversion === nub.self.version
				// browser startup OR enabled after having disabled
				nub.self.startup_reason = 'STARTUP';
			}
		}(),
        () => finishStep('storage')
	);

	// get platform info - and startup exe (desktop) or mainworker (android)
	// set callInNative
	basketmain.add(
		async function() {
			// GET PLATFORM INFO
            let stepname = 'platform_info'; // for throw
            startStep(stepname);
			nub.platform = await browser.runtime.getPlatformInfo();
            finishStep(stepname);

            // stepname = 'platform_setup';
            // startStep(stepname);
            //
            // // SET CALLINNATIVE
            // callInNative = nub.platform.os == 'android' ? callInMainworker : callInExe;
            //
			// // CONNECT TO NATIVE
			// if (nub.platform.os == 'android') {
			// 	callInBootstrap('startupMainworker', { path:nub.path.chrome.scripts + 'mainworker.js' });
			// 	// worker doesnt start till first call, so just assume it connected
            //
			// 	// no need to verify host version, as its the one from the chromeworker
			// } else {
            //     let didautoupdate = 0;
            //     let is_nativeconnect_init = true;
            //     while (is_nativeconnect_init || didautoupdate === 1) {
            //         is_nativeconnect_init = false;
            //         didautoupdate = didautoupdate === 1 ? -1 : 0; // meaning this is the first loop after doing auto-upddate so lets set to -1 so it doesnt keep doing it
            //         console.log('trying new Comm.server.webextexe');
    		// 		try {
    		// 			await new Promise((resolve, reject) => {
    		// 				gExeComm = new Comm.server.webextexe('trigger', ()=>resolve(), err=>reject(err))
    		// 			});
    		// 		} catch(first_conn_err) {
    		// 			// exe failed to connect
    		// 			console.error('failed to connect to exe, first_conn_err:', first_conn_err);
    		// 			if (first_conn_err) first_conn_err = first_conn_err.toString(); // because at the time of me writing this, Comm::webext.js does not give an error reason fail, i tried but i couldnt get the error reason, it is only logged to console
            //
    		// 			if (nub.browser.name == 'firefox') {
    		// 				// manifest and exe may not be installed, so try installing
    		// 				try {
    		// 					await new Promise((resolve, reject) => {
    		// 						callInBootstrap('installNativeMessaging', { manifest:nub.namsg.manifest, exe_pkgpath:getNamsgExepkgPath(), os:nub.platform.os }, err => err ? reject(err) : resolve() );
    		// 					});
    		// 				} catch(install_err) {
    		// 					console.error('install_err:', install_err);
    		// 					throw { stepname, reason:'EXE_INSTALL', text:chrome.i18n.getMessage('startupfailed_execonnectinstall', [first_conn_err, install_err.toString()]) };
    		// 				}
            //
    		// 				// ok installed, try re-connecting
            //                 console.log('ok trying to reconnect as did fx_install');
    		// 				try {
    		// 					await new Promise((resolve, reject) => {
    		// 						gExeComm = new Comm.server.webextexe('trigger', ()=>resolve(), err=>reject(err))
    		// 					});
    		// 				} catch(re_conn_err) {
    		// 					throw { stepname, reason:'EXE_CONNECT', text:chrome.i18n.getMessage('startupfailed_execonnect', re_conn_err) };
    		// 				}
    		// 			} else {
    		// 				throw { stepname, reason:'EXE_CONNECT', text:chrome.i18n.getMessage('startupfailed_execonnect', first_conn_err) };
    		// 			}
            //
    		// 		}
            //
    		// 		// ok connected
            //
    		// 		// lets verify the exe is for this version of extension, else send it exe from within for self update/downgrade
    		// 		// btw if it gets here, its not android, as if it was android it `return`ed earlier after starting worker
            //
    		// 		// verify exe version
    		// 		let exeversion = await new Promise( resolve => callInExe('getExeVersion', undefined, val => resolve(val)) );
    		// 		console.log('exeversion:', exeversion);
    		// 		let extversion = nub.self.version;
    		// 		console.log('extversion:', extversion);
    		// 		console.log('equal?');
            //
    		// 		if (exeversion !== extversion) {
    		// 			// version mismatch, lets fetch the exe and send it to the current exe so it can self-apply
    		// 			try {
            //                 if (didautoupdate === -1) throw 'BAD_EXE_WITHIN_EXT'; // this will trigger block link77577 // already did do the auto-upddate, so its a bade exe in my extension
            //
            //                 console.log('as not equal, am fetching exearrbuf');
        	// 				let exearrbuf = (await xhrPromise(getNamsgExepkgPath(), { restype:'arraybuffer' })).xhr.response;
        	// 				// let exearrbuf = (await xhrPromise('https://cdn2.iconfinder.com/data/icons/oxygen/48x48/actions/media-record.png', { restype:'arraybuffer' })).xhr.response;
            //                 let exeuint8str = new Uint8Array(exearrbuf).toString();
            //
    		// 				console.log('sending exeuint8str to exe');
    		// 				await new Promise(  (resolve, reject)=>callInExe( 'applyExe', exeuint8str, applyfailed=>applyfailed?reject(applyfailed):resolve(true) )  );
            //                 gExeComm.unregister();
            //                 didautoupdate = 1;
            //                 console.error('WILL RETRY NATIVE CONNECT');
            //                 continue;
            //                 // i dont really need to do this, it will all get overwritten
            //                 // gExeComm = null;
            //                 // callInNative = null;
            //                 // callInExe = null;
    		// 			} catch(exe_apply_err) {
            //                 // link77577
    		// 				console.error('exe_apply_err:', exe_apply_err);
    		// 				let howtofixstr = isSemVer(extversion, '>' + exeversion) ? chrome.i18n.getMessage('startupfailed_exemismatch_howtofix1') : chrome.i18n.getMessage('startupfailed_exemismatch_howtofix2');
    		// 				throw { stepname, reason:'EXE_MISMATCH', text:chrome.i18n.getMessage('startupfailed_exemismatch', [exeversion, extversion, howtofixstr]) }; // debug: commented out
    		// 			}
    		// 		}
            //     }
			// }
            //
            // finishStep('platform_setup')
		}()
	);

	try {
		await basketmain.run();

        console.log('ok basketmain done');

        // // CALL NATIVE INIT
        // startStep('platform_init');
        // let reason_or_nativenub = await callIn('Native', 'init', nub);
        // if (typeof(reason_or_nativenub) == 'string') {
        //     // it is error reason
        //     throw { stepname:'platform_init', reason:reason_or_nativenub };
        // } else {
        //     Object.assign(nub, reason_or_nativenub); // not required
        // }
        // finishStep('platform_init');

        nub.self.fatal = null;
        init();
	} catch(err) {
        // err - if its mine it should be object with stepname, reason, subreason
		console.error('onPreinitFailed, err:', err);

        nub.self.fatal = err;

        let stepname;
        if (err && typeof(err) == 'object' && err.stepname) stepname = err.stepname;
        errorStep(stepname);

		// build body, based on err.reason, with localized template and with err.text and errex
		let bodyarr;
		switch (err.reason) {
			// case 'STG_CONNECT': // let default handler take care of this
			// 		//
			// 	break;
			// case 'EXE_CONNECT':
			//
			// 		bodyarr = [chrome.i18n.getMessage('startupfailed_execonnect') + ' ' + (err.text || chrome.i18n.getMessage('startupfailed_unknown'))]
			// 		if (errex) bodyarr[0] += ' ' + errex.toString();
			//
			// 	break;
			default:
				var txt = '';
				if (err.text) txt += err.text;
				// if (txt && errex) txt += '\n';
				// if (errex) txt += errex;

				bodyarr = [ txt || chrome.i18n.getMessage('startupfailed_unknown') ];
		}
		let body = chrome.i18n.getMessage('startupfailed_body', bodyarr);

		// show error to user
		callInBootstrap('showSystemAlert', { title:chrome.i18n.getMessage('startupfailed_title'), body:body });
	}
}

async function init() {
	// after receiving nub
	console.log('in init, nub:', nub);

	startupBrowserAction();

	switch (nub.self.startup_reason) {
		case 'STARTUP':
				// was already installed, just regular startup to enabling or browser starting up
			break;
		case 'INSTALL':
				// first run
			break;
		case 'UPGRADE':
			break;
		case 'DOWNGRADE':
			break;
	}

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
				name: chrome.i18n.getMessage('browseraction_title'),
				// iconpath: chrome.runtime.getURL('images/icon.svg')
				checkable: false
			}
		});
	} else {
		setBrowserAction({ color:'#7DCE8D' });
	}
}
function onBrowserActionClicked() {
    addTab(nub.path.pages + 'app.html');
    // nub.self.fatal
        // undefined // show in process of starting up page
        // null // ok addon is running smoothly, it started up
        // else // show critical startup error
}
// end - browseraction

async function fetchData(aArg={}) {
	let { hydrant_instructions, nub:wantsnub } = aArg;
	// xprefs means xpcom prefs

	let data = {};
	console.log('PromiseBasket:', PromiseBasket);
	let basketmain = new PromiseBasket;

	if (wantsnub) data.nub = nub;

	if (hydrant_instructions) {
		data.hydrant = {};

		if ('stg' in hydrant_instructions) {
			basketmain.add(
				storageCall('local', 'get', Object.keys(hydrant_instructions.stg)),
				stgeds => data.hydrant.stg = stgeds
				// stgeds => { console.log('got stgeds:', stgeds); data.stg = stgeds; }
			);
		}

        if ('lang' in hydrant_instructions) {
            basketmain.add(
                async function() {
                    data.hydrant.lang = await getSelectedLocale('addon_desc');
                }()
			);
        }

		// if ('xprefs' in hydrant_instructions) { // xpcom_prefs
		// 	basketmain.add(
		// 		new Promise( resolve=>callInBootstrap('getXPrefs', { nametypes:{  'geo.provider.testing':'boolean', 'geo.wifi.uri':'string'  } }, xprefs => resolve(xprefs)) ),
		// 		xprefvals => data.hydrant.xprefs=xprefvals
		// 		// xprefvals => { console.error('got xprefvals in bg:', xprefvals); data.xprefs=xprefvals; }
		// 	)
		// }
	}

	await basketmain.run();
	return data;
}

// start - redir to app
const APP_REDIRURL_START = 'http://127.0.0.1/' + nub.self.chromemanifestkey + '-app';
function appRedirListener(detail) {
  let { url, tabId:tabid } = detail;

  // if (!url.startsWith(APP_REDIRURL_START)) return; // needed for webNavigation
  console.error('ok appRedirListener triggred, url:', url);

  let redirurl = nub.path.pages + 'app.html';
  if (url.includes('?')) {
    let querystr = url.substr(url.indexOf('?'));
    redirurl += querystr;
  }
  // console.log('redirurl:', redirurl);

  if (tabid) setTimeout(()=>browser.tabs.update(tabid, { url:redirurl }), 0); // needed for `webNavigation.Committed` - TODO: support android for controling load in this tab // also needed for `webRequest.onBeforeRequest` because redirecting to a moz-extension:// page is a bug that doesnt work right now
  return { cancel:true, redirectUrl:redirurl }; // needed for `webRequest.onBeforeRequest`
}
browser.webRequest.onBeforeRequest.addListener(appRedirListener, { urls:[ APP_REDIRURL_START + '*'] }, ['blocking']); // catches php redir of paypal2.php to http://127.0.0.1/trigger-app?page=*
// browser.webNavigation.onCommitted.addListener(appRedirListener); // when offline it works which is interesting. because when online it seems the request goes through in the back // catches when user goes to reauth page but is redirected immediately because they already had approved the app in the past

// end - redir to app

// start - polyfill for android
function browserActionSetTitle(title) {
	if (nub.platform.os != 'android') {
		chrome.browserAction.setTitle({title});
	} else {
		callInBootstrap('update');
	}
}
function setBrowserAction({text, color, tabid=-1}) {
    if (text !== undefined) browser.browserAction.setBadgeText({  text, ...(tabid!==-1?{tabid}:{})  }); // as text can be blank string to remove it
    if (color) browser.browserAction.setBadgeBackgroundColor({  color, ...(tabid!==-1?{tabid}:{})  });
}
async function closeTab(tabids) {
  // if tabids is undefined, then it removes the current active tab
  if (!tabids) {
    let tabs = await browser.tabs.query({currentWindow:true, active:true});
    if (tabs && tabs.length) {
      let curtab = tabs[0];
      console.log('curtab:', curtab);
      tabids = curtab.id;
    } else {
      return; // no current tab? weird
    }
  }

  await browser.tabs.remove(tabids);
}
async function addTab(url) {
  // url is either string or an object
  let opts = typeof(url) == 'object' ? url : { url };
  url = typeof(url) == 'object' ? url.url : url;

  if ('index_offset' in opts) {
    // dont provide `-index_offset` key if you dont want it to be relative to current
    // will position the tab at the current tabs index plus this value
    let { index_offset } = opts;
    delete opts.index_offset;
    let tabs = await browser.tabs.query({currentWindow:true, active:true});
    if (tabs && tabs.length) {
      let curtab = tabs[0];
      console.log('curtab:', curtab);
      opts.index = curtab.index + index_offset;
    }
  }

	if (browser.tabs && browser.tabs.create) {
		browser.tabs.create(opts);
	} else {
		// its android with no support for tabs
		callInBootstrap('addTab', { url });
	}
}
function reuseElseAddTab(url) {
	// find tab by url, if it exists focus its window and tab and the reuse it. else add tab
}
// end - polyfill for android

// start - addon specific helpers
function getNamsgExepkgPath() {
	let exe_subdir = ['win', 'mac'].includes(nub.platform.os) ? nub.platform.os : 'nix';
	let exe_filename = nub.namsg.manifest.name + (nub.platform.os == 'win' ? '.exe' : '');
	let exe_pkgpath = nub.path.exe + exe_subdir + '/' + exe_filename; // path to the exe inside the xpi
	return exe_pkgpath;
}

function formatNubPaths() {

	// make relative paths, non-relative
	// and push to nub.path.chrome
	for (var relkey in nub.path) {
		if (relkey == 'chrome') continue;
		nub.path.chrome[relkey] = 'webextension/' + nub.path[relkey];
		nub.path[relkey] = chrome.runtime.getURL(nub.path[relkey]);
	}

	// prefix chrome paths
	for (var chromekey in nub.path.chrome) {
		nub.path.chrome[chromekey] = 'chrome://' + nub.self.chromemanifestkey + '/content/' + nub.path.chrome[chromekey];
	}
}
// end - addon specific helpers

preinit()
.then(val => console.log('preinit done'))
.catch(err => console.error('preinit err:', err));
