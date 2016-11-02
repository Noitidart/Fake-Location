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
	var pending_stg_update = {};
	for (var p in hydrant) {
		var is_different = React.addons.shallowCompare({props:hydrant[p]}, state[p]);
		if (is_different) {
			console.log('something in', p, 'of hydrant was updated');
			hydrant_updated = true;

			if (!gSupressUpdateHydrantOnce) {
				// update file storages or whatever storage this key in hydrant is connected to

				if (hydrant.stg && p in hydrant.stg) {
					pending_stg_update[p] = state[p];
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
		if (pending_stg_update) {
			var aKeys = await callInBackground('storageCall', { aArea: 'local', aAction: 'set', aKeys: pending_stg_update})
			for (let setkey in aKeys) {
				if (setkey in nub.stg) nub.stg[setkey] = aKeys[setkey];
			}
		}
	}

	console.log('done shouldUpdateHydrant');
}

var hydrant = {
	stg: {
		// set defaults here, as if it never has been set with `storageCall('storaget', 'set')` then `fetchData` will get back an empty object
		pref_lat: '0',
		pref_lng: '0',
		mem_faking: false
	}
};

// ACTIONS
const SET_STG = 'SET_STG';
const SET_STGS = 'SET_STGS';
const SET_MAIN_KEYS = 'SET_MAIN_KEYS';

// ACTION CREATORS
function setStg(name, val) {
	return {
		type: SET_STG,
		name,
		val
	}
}
function setStgs(namevals) {
	return {
		type: SET_STGS,
		namevals
	}
}
// REDUCERS
function stg(state=hydrant.stg, action) {
	switch (action.type) {
		case SET_STG:
			var { name, val } = action;
			return Object.assign({}, state, {
				[name]: val
			});
		case SET_STGS:
			var { namevals } = action;
			return Object.assign({}, state, namevals);
		case SET_MAIN_KEYS:
			var { obj_of_mainkeys } = action;
			var mainkey = 'stg';
			return (mainkey in obj_of_mainkeys ? obj_of_mainkeys[mainkey] : state);
		default:
			return state;
	}
}

var app = Redux.combineReducers({
	stg
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
		const { lat='0', lng='0', isenabled } = this.props; // mapped state
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
			lat: state.stg.pref_lat,
			lng: state.stg.pref_lng,
			isenabled: state.stg.mem_faking
		}
	},
	function(dispatch, ownProps) {
		return {
			enable: () => {
				let lat = document.getElementById('lat').value;
				let lng = document.getElementById('lng').value;

				var stgvals = { pref_lat:lat, pref_lng:lng, mem_faking:true };
				callInBackground('storageCall', { aArea:'local',aAction:'set',aKeys:stgvals }, ()=>callInBackground('setFaking', true))
				dispatch(setStgs(stgvals));
			},
			disable: () => {
				var stgvals = { mem_faking:false };
				callInBackground('storageCall', { aArea:'local',aAction:'set',aKeys:stgvals }, ()=>callInBackground('setFaking', false))
				dispatch(setStgs(stgvals));
			}
		}
	}
)(Form);
