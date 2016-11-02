var gBgComm = new Comm.client.webextports('tab');
var callInBackground = Comm.callInX2.bind(null, gBgComm, null, null);
// var callInExe = Comm.callInX2.bind(null, gBgComm, 'callInExe', null);
var callInBootstrap = Comm.callInX2.bind(null, gBgComm, 'callInBootstrap', null);
// var callInMainworker = Comm.callInX2.bind(null, gBgComm, 'callInMainworker', null);

var nub;
var store;

var gSupressUpdateHydrantOnce;
var gAppPageComponents = [];

function init() {
	console.error('calling fetchData with hydrant skeleton:', hydrant);
	callInBackground('fetchData', { hydrant, nub:1 }, function(aArg) {
		console.log('aArg in app.js:', JSON.parse(JSON.stringify(aArg)));
		nub = aArg.nub;

		// set up some listeners
		// window.addEventListener('unload', uninit, false);

		// setup and start redux
		if (app) {
			if (hydrant) Object.assign(hydrant, aArg.hydrant); // dont update hydrant if its undefined, otherwise it will screw up all default values for redux

			store = Redux.createStore(app);

			if (hydrant) {
				store.subscribe(shouldUpdateHydrant);
			}
		}


		// start async-proc84899
		var initPage = function() {
			var page_inited = initAppPage(aArg);
			if (page_inited && page_inited.constructor.name == 'Promise') {
				page_inited.then(afterPageInited);
			} else {
				afterPageInited();
			}
		}

		var afterPageInited = function() {
			// render react
			ReactDOM.render(
				React.createElement(ReactRedux.Provider, { store },
					React.createElement(App)
				),
				document.getElementById('root')
			);
			if (typeof(focusAppPage) != 'undefined') {
				window.addEventListener('focus', focusAppPage, false);
			}
		};

		initPage();
		// end async-proc84899

	});
}
window.addEventListener('DOMContentLoaded', init, false);

// app page stuff
function focusAppPage() {
	console.log('focused!!!!!!');
}

function initAppPage() {
	gAppPageComponents = [
		React.createElement(FormContainer)
	];
}

function uninitAppPage() {

}

async function shouldUpdateHydrant() {
	return;

	console.log('in shouldUpdateHydrant');

	var state = store.getState();

	// check if hydrant updated
	var hydrant_updated = false;
	var pending_store_update = {};
	for (var p in hydrant) {
		var is_different = React.addons.shallowCompare({props:hydrant[p]}, state[p]);
		if (is_different) {
			console.log('something in', p, 'of hydrant was updated');
			hydrant_updated = true;

			if (!gSupressUpdateHydrantOnce) {
				// update file stores or whatever store this key in hydrant is connected to

				if (hydrant.store && p in hydrant.store) {
					pending_store_update[p] = state[p];
				} else if (p == 'addon_info') {
					// make sure it is just applyBackgroundUpdates, as i only support changing applyBackgroundUpdates
					if (hydrant.addon_info.applyBackgroundUpdates !== state.addon_info.applyBackgroundUpdates) {
						callInBootstrap('setApplyBackgroundUpdates', state.addon_info.applyBackgroundUpdates);
					}
				}
			}
			console.log('compared', p, 'is_different:', is_different, 'state:', state[p], 'hydrant:', hydrant[p]);
			hydrant[p] = state[p];
			// break; // dont break because we want to update the hydrant in this global scope for future comparing in this function.
		}
	}

	if (gSupressUpdateHydrantOnce) {
		console.log('hydrant update supressed once');
		gSupressUpdateHydrantOnce = false;
		return;
	} else {
		if (pending_store_update) {
			var aKeys = await callInBackground('storageCall', { aArea: 'local', aAction: 'set', aKeys: pending_store_update})
			for (let setkey in aKeys) {
				if (setkey in nub.store) nub.store[setkey] = aKeys[setkey];
			}
		}
	}

	console.log('done shouldUpdateHydrant');
}

var hydrant = {
	store: {
		// set defaults here, as if it never has been set with `storageCall('storaget', 'set')` then `fetchData` will get back an empty object
		pref_lat: '0',
		pref_lng: '0'
	},
	xprefs: {
		'geo.wifi.uri': null,
		'geo.provider.testing': null
	}
};

// ACTIONS
const SET_PREF = 'SET_PREF';
const SET_PREFS = 'SET_PREFS';
const SET_MAIN_KEYS = 'SET_MAIN_KEYS';
const SET_XPREF = 'SET_XPREF';
const SET_XPREFS = 'SET_XPREFS';

// ACTION CREATORS
function setPref(name, val) {
	return {
		type: SET_PREF,
		name,
		val
	}
}
function setPrefs(namevals) {
	return {
		type: SET_PREFS,
		namevals
	}
}
function setXPrefs(namevals) {
	return {
		type: SET_XPREFS,
		namevals
	}
}
function setMainKeys(obj_of_mainkeys) {
	gSupressUpdateHydrantOnce = true;
	return {
		type: SET_MAIN_KEYS,
		obj_of_mainkeys
	}
}

// REDUCERS
function prefs(state=hydrant.store, action) {
	switch (action.type) {
		case SET_PREF:
			var { name, val } = action;
			return Object.assign({}, state, {
				[name]: val
			});
		case SET_PREFS:
			var { namevals } = action;
			return Object.assign({}, state, namevals);
		case SET_MAIN_KEYS:
			var { obj_of_mainkeys } = action;
			var mainkey = 'prefs';
			return (mainkey in obj_of_mainkeys ? obj_of_mainkeys[mainkey] : state);
		default:
			return state;
	}
}
function xprefs(state=hydrant.xprefs, action) {
	switch (action.type) {
		case SET_XPREF:
			var { name, val } = action;
			return Object.assign({}, state, {
				[name]: val
			});
		case SET_XPREFS:
			var { namevals } = action;
			return Object.assign({}, state, namevals);
		case SET_MAIN_KEYS:
			var { obj_of_mainkeys } = action;
			var mainkey = 'xprefs';
			return (mainkey in obj_of_mainkeys ? obj_of_mainkeys[mainkey] : state);
		default:
			return state;
	}
}

var app = Redux.combineReducers({
	prefs,
	xprefs
});

// REACT COMPONENTS - PRESENTATIONAL
var App = React.createClass({
	render: function() {

		var app_components = [
			// 'HEADER',
			...gAppPageComponents
			// 'FOOTER'
		];

		return React.createElement('div', { id:'app', className:'app' },
			app_components
		);
	}
});

var Form = React.createClass({
	displayName: 'Form',
	render() {
		const { lat, lng, isenabled } = this.props; // mapped state
		const { enable, disable } = this.props; // dispatchers

		console.error('lat:', lat, 'lng:', lng);

		return React.createElement('div', {},
			React.createElement('div', { className:'row'},
				React.createElement('label', { htmlFor:'lat' },
					'Latitude'
				),
				React.createElement('input', { type:'text', id:'lat', defaultValue:lat, key:'lat_'+lat })
			),
			React.createElement('div', { className:'row'},
				React.createElement('label', { htmlFor:'lng' },
					'Longitude'
				),
				React.createElement('input', { type:'text', id:'lng', defaultValue:lng, key:'lng_'+lng })
			),
			React.createElement('div', { className:'row' },
				React.createElement('button', { onClick:enable },
					chrome.i18n.getMessage('fake_enable')
				),
				React.createElement('button', { onClick:disable, disabled:!isenabled },
					chrome.i18n.getMessage('fake_disable')
				)
			)
		);
	}
});

// REACT COMPONENTS - CONTAINER
var FormContainer = ReactRedux.connect(
	function(state, ownProps) {
		return {
			lat: state.prefs.pref_lat,
			lng: state.prefs.pref_lng,
			isenabled: state.xprefs['geo.provider.testing']
		}
	},
	function(dispatch, ownProps) {
		return {
			enable: () => {
				let lat = document.getElementById('lat').value;
				let lng = document.getElementById('lng').value;
				let serveruri = 'https://fake-location.sundayschoolonline.org/?lat=' + lat + '&lng=' + lng;
				let prefvals = {'pref_lat':lat,'pref_lng':lng};
				let xprefvals = {'geo.wifi.uri':serveruri,'geo.provider.testing':true};
				callInBootstrap('setXPrefs', { xprefs:xprefvals } );
				callInBackground('storageCall', { aArea:'local',aAction:'set',aKeys:prefvals })
				dispatch(setPrefs(prefvals));
				dispatch(setXPrefs(xprefvals));
			},
			disable: () => {
				let xprefvals = {'geo.wifi.uri':null,'geo.provider.testing':null};
				callInBootstrap('setXPrefs', { xprefs:xprefvals });
				dispatch(setXPrefs(xprefvals));
			}
		}
	}
)(Form);
