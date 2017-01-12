console.log('in mainworker.js');
// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('chrome://{{CHROMEMANIFESTKEY}}/content/webextension/scripts/comm/webext.js');

var gBsComm = new Comm.client.worker();
var callInBootstrap = Comm.callInX2.bind(null, gBsComm, null, null);
var callInBackground = Comm.callInX2.bind(null, gBsComm, 'callInBackground', null);
var callInExe = Comm.callInX2.bind(null, gBsComm, 'callInExe', null);

var jenv; // android
let nub = { // link39181
    nativetype: 'worker',
    worker: {}
};

switch (OS.Constants.Sys.Name) {
	case 'Android':

            // make JNI.jsm safe for workers by removing the Components parts
            let req = new XMLHttpRequest();
            req.open('GET', 'resource://gre/modules/JNI.jsm', false); // 3rd arg is false for synchronus
            req.send();
            let jnijsm = req.response.replace('var EXPOR', '// var EXPOR').replace('Components.utils.import(', '// Components.utils.import(');

            // importScripts('chrome://trigger/content/webextension/scripts/3rd/jni-worker.jsm');
            importScripts('data:text/plain,' + jnijsm);
			jenv = JNI.GetForThread();

		break;
	default:
		console.error('OS not supported by "mainworker.js"')
}

function onBeforeTerminate() {
	JNI.UnloadClasses(jenv);
}

// start - addon functions
function init(aNub) {
    // on successful init, return objct with nativetype (string;enum[worker,exe]) and the object entry // link39181

    // Object.assign(nub, aNub); // i dont really need to do this, as functions in here are just called by background, thats the main guy

    // return { nativetype, aNub[nativetype] };
    return 'PLATFORM_NOT_YET_SUPPORTED';
}
function getSystemDirectory_android(type) {
	// progrmatic helper for getSystemDirectory in MainWorker - devuser should NEVER call this himself
	// type - string - currently accepted values
		// DIRECTORY_DOWNLOADS
		// DIRECTORY_MOVIES
		// DIRECTORY_MUSIC
		// DIRECTORY_PICTURES

	var SIG = {
		Environment: 'Landroid/os/Environment;',
		String: 'Ljava/lang/String;',
		File: 'Ljava/io/File;'
	};

	var Environment = JNI.LoadClass(jenv, SIG.Environment.substr(1, SIG.Environment.length - 2), {
		static_fields: [
			{ name: 'DIRECTORY_DOWNLOADS', sig: SIG.String },
			{ name: 'DIRECTORY_MOVIES', sig: SIG.String },
			{ name: 'DIRECTORY_MUSIC', sig: SIG.String },
			{ name: 'DIRECTORY_PICTURES', sig: SIG.String }
		],
		static_methods: [
			{ name:'getExternalStorageDirectory', sig:'()' + SIG.File }
		]
	});

	var jFile = JNI.LoadClass(jenv, SIG.File.substr(1, SIG.File.length - 2), {
		methods: [
			{ name:'getPath', sig:'()' + SIG.String }
		]
	});

	var OSPath_dirExternalStorage = JNI.ReadString(jenv, Environment.getExternalStorageDirectory().getPath());
	var OSPath_dirname = JNI.ReadString(jenv, Environment[type]);
	var OSPath_dir = OS.Path.join(OSPath_dirExternalStorage, OSPath_dirname);
	console.log('OSPath_dir:', OSPath_dir);

	return OSPath_dir;
}
