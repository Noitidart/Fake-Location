// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');

// Globals
var nub = { // brought over from background.js if needed
	path: {
		chrome: {
			scripts: 'chrome://fake-location/content/webextension/scripts/'
		}
	}
};

var gAndroidMenus = [];

var gBgComm;
var gWkComm;
var callInBackground;
var callInExe;
var callInMainworker;

function install() {}
function uninstall(aData, aReason) {
    if (OS.Constants.Sys.Name != 'Android' && aReason == ADDON_UNINSTALL) {
		// uninstallNativeMessaging() // if it wasnt installed, then this will do nothing
		// .then(valarr => { console.log('uninstalled:', valarr); cleanupNativeMessaging(); })
		// .catch(err => console.error('uninstall error:', err));
	}
}

function startup(aData, aReason) {

	Services.scriptloader.loadSubScript(nub.path.chrome.scripts + '3rd/polyfill.min.js');
	Services.scriptloader.loadSubScript(nub.path.chrome.scripts + '3rd/comm/webext.js');

	var promiseallarr = [];

	// if (OS.Constants.Sys.Name != 'Android' && [ADDON_DOWNGRADE, ADDON_UPGRADE, ADDON_INSTALL].includes(aReason)) {
	// 	promiseallarr.push( installNativeMessaging() );
	// }

	// wait for all promises, then startup webext
	Promise.all(promiseallarr)
	.then(valarr => {
		console.log('valarr:', valarr);
		gBgComm = new Comm.server.webext(aData.webExtension); // starts up the webext
		callInBackground = Comm.callInX2.bind(null, gBgComm, null, null);
		// callInExe = Comm.callInX2.bind(null, gBgComm, 'gExeComm', null);
	})
	.catch( caught => console.error('Failed to prepare for webext startup, caught:', caught) );
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) return;

	shutdownAndroid(); // if its not android it wont do anything
}

// // start - mainworker stuff
// function startupMainworker(aArg) {
// 	var { path, initdata } = aArg;
//
// 	gWkComm = new Comm.server.worker(path, initdata ? ()=>initdata : undefined, undefined, onMainworkerBeforeShutdown);
// 	callInMainworker = Comm.callInX2.bind(null, gWkComm, null, null);
//
// 	// its lazy started, meaning it wont actually start till first call
// }
//
// function onMainworkerBeforeShutdown() {
// 	return new Promise(resolve => callInMainworker('onBeforeTerminate', undefined, aArg => resolve()) );
// }
//
// // end - mainworker stuff

// start - android stuff
var gBrowserAction; // object; keys[title, iconpath]
var gStartedupAndroid = false;
function startupAndroid(aArg) {
	if (OS.Constants.Sys.Name != 'Android') return;

	gStartedupAndroid = true;
	gBrowserAction = aArg.browseraction;
	windowListenerAndroid.register();
}

function shutdownAndroid() {

	if (OS.Constants.Sys.Name != 'Android') return;
	if (!gStartedupAndroid) return;

	// Remove inserted menu entry
	for (var androidmenu of gAndroidMenus) {
		var { domwin, menuid } = androidmenu;
		domwin.NativeWindow.menu.remove(menuid);
	}
}

function onBrowserActionClicked() {
	callInBackground('onBrowserActionClicked');
}

function addTab(aArg, aReportProgress, aComm) {
	var { url } = aArg;
	var win = Services.wm.getMostRecentWindow('navigator:browser');
	win.BrowserApp.addTab(url);
}

var windowListenerAndroid = {
	//DO NOT EDIT HERE
	onOpenWindow: function(aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListenerAndroid.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function(aXULWindow) {
		if (windowListenerAndroid.windowClosed) {
			var window = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
			windowListenerAndroid.windowClosed(window);
		}
	},
	onWindowTitleChange: function(aXULWindow, aNewTitle) {},
	register: function() {

		// Load into any existing windows
		var windows = Services.wm.getEnumerator(null);
		while (windows.hasMoreElements()) {
			var window = windows.getNext();
			if (window.document.readyState == 'complete') { //on startup `window.document.readyState` is `uninitialized`
				windowListenerAndroid.loadIntoWindow(window);
			} else {
				window.addEventListener('load', function () {
					window.removeEventListener('load', arguments.callee, false);
					windowListenerAndroid.loadIntoWindow(window);
				}, false);
			}
		}

		// Listen to new windows
		Services.wm.addListener(windowListenerAndroid);
	},
	unregister: function() {
		// Unload from any existing windows
		var windows = Services.wm.getEnumerator(null);
		while (windows.hasMoreElements()) {
			var window = windows.getNext();
			windowListenerAndroid.unloadFromWindow(window);
		}

		// Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListenerAndroid);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

            // desktop_android:insert_gui
			if (OS.Constants.Sys.Name == 'Android') {
                // // android:insert_gui
				if (aDOMWindow.NativeWindow && aDOMWindow.NativeWindow.menu) {
					var menuid = aDOMWindow.NativeWindow.menu.add({
						name: gBrowserAction.title,
						// icon: gBrowserAction.iconpath,
						callback: onBrowserActionClicked
					});
					gAndroidMenus.push({
						domwin: aDOMWindow,
						menuid
					});
				}
			}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

	},
	windowClosed: function(aDOMWindow) {
		// Remove from gAndroidMenus the entry for this aDOMWindow
		if (OS.Constants.Sys.Name == 'Android') {
			var l = gAndroidMenus.length;
			for (var i=0; i<l; i++) {
				var androidmenu = gAndroidMenus[i];
				if (androidmenu.domwin == aDOMWindow) {
					gAndroidMenus.splice(i, 1);
					break;
				}
			}
		}
	}
};
// end - android stuff

// // start - native messaging stuff
// function getNativeMessagingInfo() {
// 	// returns { os_sname, exe_path, exe_from, exe_name, exemanifest_path, exemanifest_from, exemanifest_json, winregistry_path }
// 	// `winregistry_path` is undefined if not windows
// 	// os_sname is win/mac/nix
//
// 	// nub.nativemessaging.manifest_json = { // this is setup in background.js
// 	//   'name': 'profilist', // i use this as child entry for windows registry entry, so make sure this name is compatible with injection into windows registry link39191
// 	//   'description': 'Platform helper for Profilist',
// 	//   'path': undefined, // set below to `exe_path`,
// 	//   'type': 'stdio',
// 	//   'allowed_extensions': [ nub.self.id ]
// 	// };
//
// 	var exe_name;
// 	var sname = OS.Constants.Sys.Name.toLowerCase(); // stands for "simplified name". different from `mname`
// 	if (sname.startsWith('win')) {
// 		sname = 'win';
// 		exe_name = nub.nativemessaging.manifest_json.name + '.exe';
// 	} else if (sname == 'darwin') {
// 		sname = 'mac';
// 		exe_name = nub.nativemessaging.manifest_json.name;
// 	} else {
// 		sname = 'nix';
// 		exe_name = nub.nativemessaging.manifest_json.name;
// 	}
//
// 	var exe_path;
// 	exe_path = OS.Path.join(OS.Constants.Path.userApplicationDataDir, 'extension-exes', exe_name);
//
// 	var exe_from = OS.Constants.Path.userApplicationDataDir; // dir that exists for sure in subpath of `exe_path`. where to `makeDir` from for exe
//
// 	// update nub.nativemessaging.manifest_json
// 	nub.nativemessaging.manifest_json.path = exe_path;
// 	nub.nativemessaging.manifest_json.description += ' for ' + sname;
//
// 	var exemanifest_path;
// 	var exemanifest_from; // dir that exists for sure in subpath of `exemanifest_path`. where to `makeDir` from for exe
// 	switch (sname) {
// 		case 'win':
// 				// exemanifest_path = OS.Path.join(nub.path.storage, 'profilist.json');
// 				// exemanifest_from = nub.path.profileDir;
// 				exemanifest_path = OS.Path.join(OS.Constants.Path.userApplicationDataDir, 'extension-exes', 'profilist.json');
// 				exemanifest_from = OS.Constants.Path.userApplicationDataDir;
// 			break;
// 		case 'mac':
// 				exemanifest_path = OS.Path.join(OS.Constants.Path.homeDir, 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts', 'profilist.json');
// 				exemanifest_from = OS.Path.join(OS.Constants.Path.homeDir, 'Library', 'Application Support');
// 			break;
// 		case 'nix':
// 				exemanifest_path = OS.Path.join(OS.Constants.Path.homeDir, '.mozilla', 'native-messaging-hosts', 'profilist.json');
// 				exemanifest_from = OS.Constants.Path.homeDir;
// 			break;
// 	}
//
// 	var winregistry_path;
// 	if (sname == 'win') {
// 		winregistry_path = 'SOFTWARE\\Mozilla\\NativeMessagingHosts';
// 	}
//
// 	return { os_sname:sname, exe_path, exe_from, exe_name, exemanifest_path, exemanifest_from, exemanifest_json:nub.nativemessaging.manifest_json, winregistry_path };
//
// }
//
// function installNativeMessaging(aArg) {
// 	// it should already be there due to `sendNub`, but just to make it not reliant on globals
// 	nub.nativemessaging = aArg.nativemessaging;
// 	nub.path = aArg.path;
//
// 	Services.prefs.setCharPref('extensions.@profilist.namsg', nub.nativemessaging.manifest_json.name);
//
// 	var { exe_path, exe_from, exe_name, exemanifest_path, exemanifest_from, exemanifest_json, winregistry_path, os_sname } = getNativeMessagingInfo();
//
// 	var promiseallarrmain = [];
//
// 	// copy the exes
// 	promiseallarrmain.push(new Promise( (resolve, reject) =>
// 		OS.File.makeDir(OS.Path.dirname(exe_path), { from:exe_from })
// 		.then( dirmade => {
// 			var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
// 			console.log(nub.path.chrome.exe + os_sname + '/' + exe_name);
// 			xhr.open('GET', nub.path.chrome.exe + os_sname + '/' + exe_name, false);
// 			xhr.responseType = 'arraybuffer';
// 			xhr.send();
//
// 			// i dont use `writeThenDirMT` because ArrayBuffer's get neutred, so if first write fails, then the arrbuf is gone I think. it might not neuter on fail though.
// 				// i actually i tested it on 092816 in "52.0a1 (2016-09-28) (64-bit)", and on fail, it does not neuter the arrbuf, only on success
// 			writeThenDirMT(exe_path, new Uint8Array(xhr.response), exe_from, { encoding:undefined })
// 			// OS.File.writeAtomic(exe_path, new Uint8Array(xhr.response), { encoding:undefined })
// 			.then( copied => {
// 				if (os_sname != 'win') {
// 					OS.File.setPermissions(exe_path, { unixMode:0o4777 }) // makes it executable, tested on mac, not yet on nix
// 					.then( resolve() )
// 					.catch( osfileerr => reject(osfileerr) )
// 				} else {
// 					resolve();
// 				}
// 			})
// 			.catch( osfileerr => reject(osfileerr) )
// 		})
// 		.catch( osfileerr => reject(osfileerr) )
// 	));
//
// 	// make sure exe manifest is in place
// 	console.log('json stringify:', JSON.stringify(exemanifest_json));
// 	promiseallarrmain.push(new Promise( (resolve, reject) =>
// 		writeThenDirMT(exemanifest_path, JSON.stringify(exemanifest_json), exemanifest_from, { noOverwrite:true, encoding:'utf-8' })
// 		.then( ok => resolve() )
// 		.catch( osfileerr => osfileerr.becauseExists ? resolve() : reject(osfileerr) )
// 	));
//
// 	// if Windows then update registry
// 	if (winregistry_path) {
// 		var wrk = Cc['@mozilla.org/windows-registry-key;1'].createInstance(Ci.nsIWindowsRegKey);
// 		wrk.create(wrk.ROOT_KEY_CURRENT_USER, winregistry_path + '\\' + exemanifest_json.name, wrk.ACCESS_WRITE); // link39191
// 		wrk.writeStringValue('', exemanifest_path);
// 		wrk.close();
// 		// not ignoring errors during write, if it errors, startup fails
// 	}
//
// 	return new Promise( (resolve, reject) => {
// 		Promise.all(promiseallarrmain)
// 		.then(resolve())
// 		.catch(err => reject(err))
// 	});
// }
//
// function uninstallNativeMessaging() {
// 	// if installed then pref is set
// 	var exemanifest_name;
// 	try {
// 		exemanifest_name = Services.prefs.getCharPref('extensions.@profilist.namsg');
// 	} catch(ex) {
// 		return Promise.reject('not installed');
// 	}
//
// 	Services.prefs.clearUserPref('extensions.@profilist.namsg');
// 	nub.nativemessaging = { manifest_json:{name:exemanifest_name} };
//
// 	var { exe_path, exe_from, exe_name, exemanifest_path, exemanifest_from, exemanifest_json, winregistry_path } = getNativeMessagingInfo();
//
// 	var promiseallarrmain = [];
//
// 	// delete exe
// 	promiseallarrmain.push( OS.File.remove(exe_path, { ignorePermissions:true, ignoreAbsent:true }) ); // ignoreAbsent because maybe another profile already deleted it
//
// 	// TODO: if `exe_path` parent dir is empty, remove it, because parent dir is my own created one of "extensions-exes"
//
// 	// delete manifest
// 	promiseallarrmain.push( OS.File.remove(exemanifest_path, { ignorePermissions:true, ignoreAbsent:true }) ); // ignoreAbsent for the hell of it
//
// 	// if Windows then update registry
// 	if (winregistry_path) {
// 		var wrk = Cc['@mozilla.org/windows-registry-key;1'].createInstance(Ci.nsIWindowsRegKey);
// 		try {
// 			wrk.open(wrk.ROOT_KEY_CURRENT_USER, winregistry_path, wrk.ACCESS_WRITE);
// 			wrk.removeChild(exemanifest_json.name); // link39191
// 		} finally {
// 			wrk.close();
// 		}
// 		// NOTE: i am ignoring errors that happen during uninstall from registry
// 	}
//
// 	return Promise.all(promiseallarrmain);
// }
//
// function cleanupNativeMessaging() {
// 	// delete the exe parent dir, if it is empty. because this parent dir is only used by my addons
// 	OS.File.removeEmptyDir(OS.Path.join(OS.Constants.Path.userApplicationDataDir, 'extension-exes'), { ignoreAbsent:true }).catch( err=>console.warn('This is totally acceptable, it means there is stuff left so should NOT cleanup. err:', err) );
// }

// start - addon functions
function showSystemAlert(aArg) {
	var { title, body } = aArg;

	Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), title, body);
}
function sendNub(aArg, aReportProgress, aComm) {
	nub = aArg.nub;
}
function setApplyBackgroundUpdates(aNewApplyBackgroundUpdates) {
	// 0 - off, 1 - respect global setting, 2 - on
	AddonManager.getAddonByID(nub.self.id, addon =>
		addon.applyBackgroundUpdates = aNewApplyBackgroundUpdates
	);
}

function getAddonInfo(aAddonId=nub.self.id) {
	var deferredmain_getaddoninfo = new Deferred();
	AddonManager.getAddonByID(aAddonId, addon =>
		deferredmain_getaddoninfo.resolve({
			applyBackgroundUpdates: parseInt(addon.applyBackgroundUpdates) === 1 ? (AddonManager.autoUpdateDefault ? 2 : 0) : parseInt(addon.applyBackgroundUpdates),
			updateDate: addon.updateDate.getTime()
		})
	);

	return deferredmain_getaddoninfo.promise;
}

function getXPrefs(aArgs) {
	let { xprefs } = aArgs;
	let rez = {};

	// xprefs should be object { [pref_string]:[pref_type]}
		// pref_type is string - string, bool, int
	// Services.prefs.PREF_STRING 32
	// Services.prefs.PREF_BOOL 128
	// Services.prefs.PREF_INT 64
	// Services.prefs.PREF_INVALID 0

	console.log('bootstrap getting xprefs:', xprefs);

	var getXTypeFromType = aPrefType => {
		switch (aPrefType.toLowerCase()) {
			case 'string':
				return 'Char';
			case 'number':
				return 'Int';
			case 'boolean':
				return 'Bool';
			default:
				throw new Error('invalid value for pref_type: "' + aPrefType + '"');
		}
	};

	for (let a_xpref in xprefs) {
		try {
			rez[a_xpref] = Services.prefs['get' + getXTypeFromType(xprefs[a_xpref]) + 'Pref'](a_xpref);
		} catch(ex) {
			// pref doesnt exist
			// console.error('ex during getXXXPref, ex:', ex);
			rez[a_xpref] = null;
		}
	}

	return rez;
}

function setXPrefs(aArgs) {
	let { xprefs } = aArgs;
	// xprefs should be object { [pref_string]:pref_value }
		// pref_value of null means reset it

	var getXTypeFromValue = aPrefValue => {
		switch (typeof(aPrefValue)) {
			case 'string':
				return 'Char';
			case 'number':
				return 'Int';
			case 'boolean':
				return 'Bool';
			default:
				throw new Error('invalid type for aPrefValue, you probably want a string type!');
		}
	};

	for (let a_xpref in xprefs) {
		if (xprefs[a_xpref] === null) {
			Services.prefs['clearUserPref'](a_xpref);
		} else {
			Services.prefs['set' + getXTypeFromValue(xprefs[a_xpref]) + 'Pref'](a_xpref, xprefs[a_xpref]);
		}
	}
}

// start - common helper functions
function getNativeHandlePtrStr(aDOMWindow) {
	var aDOMBaseWindow = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
								   .getInterface(Ci.nsIWebNavigation)
								   .QueryInterface(Ci.nsIDocShellTreeItem)
								   .treeOwner
								   .QueryInterface(Ci.nsIInterfaceRequestor)
								   .getInterface(Ci.nsIBaseWindow);
	return aDOMBaseWindow.nativeHandle;
}
// rev2 - https://gist.github.com/Noitidart/5257376b54935556173e8d13c2821f4e
function writeThenDirMT(aPlatPath, aContents, aDirFrom, options={}) {
	// tries to writeAtomic
	// if it fails due to dirs not existing, it creates the dir
	// then writes again
	// if fail again for whatever reason it rejects with `osfileerr`
	// on success resolves with `true`

	var default_options = {
		encoding: 'utf-8',
		noOverwrite: false
		// tmpPath: aPlatPath + '.tmp'
	};

	options = Object.assign(default_options, options);

	var writeTarget = () => OS.File.writeAtomic(aPlatPath, aContents, options);

	return new Promise((resolvemain, rejectmain) =>
		writeTarget().then( ()=>resolvemain() ).catch( osfileerr => {
			if (osfileerr.becauseNoSuchFile) { // this happens when directories dont exist to it
				OS.File.makeDir(OS.Path.dirname(aPlatPath), {from:aDirFrom}).then(
					()=>writeTarget().then( ()=>resolvemain() ).catch( osfileerr=>rejectmain(osfileerr) )
				// ).catch( osfileerr=>resolvemain(false) );
				).catch( osfileerr=>rejectmain(osfileerr) );
			} else {
				rejectmain(osfileerr);
				// resolvemain(false);
			}
		})
	);
}
