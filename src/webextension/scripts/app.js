var gBgComm = new Comm.client.webextports('tab');
var callInBackground = Comm.callInX2.bind(null, gBgComm, null, null);
// var callInExe = Comm.callInX2.bind(null, gBgComm, 'callInExe', null);
var callInBootstrap = Comm.callInX2.bind(null, gBgComm, 'callInBootstrap', null);
// var callInMainworker = Comm.callInX2.bind(null, gBgComm, 'callInMainworker', null);

var nub = {};
var store;

var gSupressUpdateHydrantOnce;
var gAppPageComponents = [];

function init() {
	console.error('calling fetchData with hydrant skeleton:', hydrant);
	callInBackground('fetchData', { hydrant, nub:1 }, function(aArg) {
		console.log('aArg in app.js:', aArg);
		Object.assign(nub, aArg.nub);

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

}

function uninitAppPage() {

}

async function shouldUpdateHydrant() {
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
			var aKeys = await callInMainworker('storageCall', { aArea: 'local', aAction: 'set', aKeys: pending_store_update})
			for (let setkey in aKeys) nub.store[setkey] = aKeys[setkey];
		}
	}

	console.log('done shouldUpdateHydrant');
}

var hydrant = {
	store: {
		pref_lat: 0,
		pref_lng: 0
	}
};

// ACTIONS
const SET_PREF = 'SET_PREF';
const SET_MAIN_KEYS = 'SET_MAIN_KEYS';

// ACTION CREATORS
function setPref(pref, value) {
	return {
		type: SET_PREF,
		pref,
		value
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
			var { pref, value } = action;
			return Object.assign({}, state, {
				[pref]: value
			});
		case SET_MAIN_KEYS:
			var { obj_of_mainkeys } = action;
			var mainkey = 'prefs';
			return (mainkey in obj_of_mainkeys ? obj_of_mainkeys[mainkey] : state);
		default:
			return state;
	}
}

var app = Redux.combineReducers({
	prefs
});

// REACT COMPONENTS - PRESENTATIONAL
var App = React.createClass({
	render: function() {

		var app_components = [
			'HEADER',
			...gAppPageComponents,
			'FOOTER'
		];

		return React.createElement('div', { id:'app', className:'app' },
			app_components
		);
	}
});

// REACT COMPONENTS - CONTAINER
