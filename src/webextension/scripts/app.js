let gBgComm = new Comm.client.webextports('tab');
var callInBackground = Comm.callInX2.bind(null, gBgComm, null, null);
var callInExe = Comm.callInX2.bind(null, gBgComm, 'callInExe', null);
var callInBootstrap = Comm.callInX2.bind(null, gBgComm, 'callInBootstrap', null);
var callInMainworker = Comm.callInX2.bind(null, gBgComm, 'callInMainworker', null);
let callIn = (...args) => new Promise(resolve => window['callIn' + args.shift()](...args, val=>resolve(val))); // must pass undefined for aArg if one not provided, due to my use of spread here. had to do this in case first arg is aMessageManagerOrTabId

let nub;
let store;

let hydrant_instructions = {stg:{pref_geo:1}, lang:1};
let hydrant = {
	stg: {
		// set defaults here, as if it never has been set with `storageCall('storaget', 'set')` then `fetchData` will get back an empty object
        pref_geo: {}
	},
    lang: 'en-US'
};


window.addEventListener('DOMContentLoaded', init, false);
async function init() {
    console.error('calling fetchData with hydrant skeleton:', hydrant);
    document.title = browser.i18n.getMessage('addon_name');

    let data = await callIn('Background', 'fetchData', { hydrant_instructions, nub:1 });

    nub = data.nub;
    objectAssignDeep(hydrant, data.hydrant); // dont update hydrant if its undefined, otherwise it will screw up all default values for redux

    // set pathname for react-router
    let initial_pathname = '/';
    let qparam = {};
    try {
        qparam = queryStringDom(window.location.href);
    } catch(ignore) {}
    if (qparam.page) {
        initial_pathname += qparam.page;
        delete qparam.page;
    }
    if (Object.keys(qparam).length) initial_pathname += '?' + queryStringDom(qparam);
    window.history.replaceState({key:nub.self.chromemanifestkey + '-' + Date.now()}, browser.i18n.getMessage('addon_name'), initial_pathname);

    // prepare react-router
    gHistory = History.createBrowserHistory();
    initial_router_state.location = gHistory.location;
    initial_router_state.action = gHistory.action;
    // to programtically navigate, use gHistory.push('/one/rawr')

    // setup and start redux
    app = Redux.combineReducers({
        geo,
        lang,
        router
    });
    store = Redux.createStore(app, Redux.applyMiddleware(
        ReduxThunk.default // lets us dispatch() functions
    ));

    // render react
	ReactDOM.render(
        React.createElement(ReactRedux.Provider, { store },
            React.createElement(App)
        ),
        document.body
    );

    window.addEventListener('focus', focusAppPage, false);
}

async function focusAppPage() {
    // console.log('focused!!!!!!');
    // let data = await callIn('Background', 'fetchData', { hydrant_instructions });
    //
    // let newhydrant = data.hydrant;
    //
    // let newmainkeys = {};
    // let state = store.getState();
    // let checks = [
    //
    // ];
    //
    //
    // for (let check of checks) {
    //     let { name, dotpath, isDiff } = check;
    //
    //     const MISSING = {};
    //     let cur = deepAccessUsingString(state, dotpath.store, MISSING);
    //     if (cur === MISSING) continue; // check if dotpath is available in data, if its not, then background didnt send it over so skip it
    //
    //     let next = deepAccessUsingString(data, dotpath.data);
    //     // console.log('dotpath.data:', dotpath.data, 'next:', next, 'data:', data);
    //
    //     if (isDiff(cur, next)) {
    //         console.log(`${name} is changed! was:`, cur, 'now:', next);
    //         newmainkeys[dotpath.store] = next;
    //     }
    // }
    //
    // if (Object.keys(newmainkeys).length) store.dispatch(setMainKeys(newmainkeys));
    // else console.log('nothing changed');
}

// GERNAL ACTIONS AND CREATORS - no specific reducer because each reducer will respect these actions
const SET_MAIN_KEYS = 'SET_MAIN_KEYS';
function setMainKeys(obj_of_mainkeys) {
	return {
		type: SET_MAIN_KEYS,
		obj_of_mainkeys
	}
}

// ROUTER ACTIONS AND CREATORS AND REDUCER
let gHistory;
let initial_router_state = {};

const NAVIGATE = 'NAVIGATE';
function navigate(location, action) {
    return {
        type: NAVIGATE,
        location,
        action
    }
}

function router(state=initial_router_state, action) {
    switch (action.type) {
		case NAVIGATE:
			return {
                location: action.location,
                action: action.action
            }
		default:
			return state;
	}
}

// LANG ACTIONS AND CREATORS AND REDUCER
function lang(state=hydrant.lang, action) {
	switch (action.type) {
		case SET_MAIN_KEYS: {
			const reducer = 'lang';
			let { [reducer]:reduced } = action.obj_of_mainkeys;
			return reduced || state;
		}
		default:
			return state;
	}
}

// GEO ACTIONS AND CREATORS AND REDUCER
function geo(state=hydrant.stg.pref_geo, action) {
	switch (action.type) {
		case SET_MAIN_KEYS: {
			const reducer = 'geo';
			let { [reducer]:reduced } = action.obj_of_mainkeys;
			return reduced || state;
		}
		default:
			return state;
	}
}

let app;

const PropTypes = React.PropTypes;

const ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;
var gTrans = [ // needs to be var, so its accessible to dom-react.js
	createTrans('fadequick', 150, 150, true),
	createTrans('fade', 300, 300, true),
	createTrans('modalfade', 300, 300, true)
];
initTransTimingStylesheet(); // must go after setting up gTrans

// REACT/REDUX COMPONENTS
const App = ReactRedux.connect(
    state => ({ location: state.router.location, action: state.router.action })
)(React.createClass({
    displayName: 'App',
    propTypes: {
        location: PropTypes.object, // router/redux
        action: PropTypes.string, // router/redux
        dispatch: PropTypes.func, // redux
    },
    handleRouterChange(location, action) {
        let { dispatch } = this.props;
        console.log('router changed', 'location:', location, 'action:', action);
        if (action == 'SYNC') dispatch(navigate(location, this.props.action)); // you must always dispatch a `SYNC` action, because, guess what? you can't actual control the browser history! anyway, use your current action not "SYNC"
        else if (!window.block) dispatch(navigate(location, action)); // if you want to block transitions go into the console and type in `window.block = true` and transitions won't happen anymore
        else console.error('blocked!')
    },
    render() {
        let { location, action } = this.props;

        console.log('component App rendered, props:', this.props);

        return React.createElement(ReactHistory.ControlledBrowserRouter, { history:gHistory, location, action, onChange:this.handleRouterChange },
            React.DOM.div(null,
                React.DOM.ul(null,
                    React.DOM.li(null,
                        React.createElement(ReactRouter.Link, {to:'/one'}, 'One'),
                    ),
                    React.DOM.li(null,
                        React.createElement(ReactRouter.Link, {to:'/two'}, 'Two'),
                    ),
                    React.DOM.li(null,
                        React.createElement(ReactRouter.Link, {to:'/three'}, 'Three')
                    )
                ),
                React.DOM.div({ style:{padding:'10px'} },
                    React.createElement(ReactRouter.Match, { pattern:'/', exactly:true, component:Home }),
                    React.createElement(ReactRouter.Match, { pattern:'/one/:pid?', exactly:true, component:One }),
                    React.createElement(ReactRouter.Match, { pattern:'/two', exactly:true, render:()=>React.DOM.div(null, 'Two') }),
                    React.createElement(ReactRouter.Match, { pattern:'/three', exactly:true, render:()=>React.DOM.div(null, 'Three') })
                )
            )
        );
    }
}));

const Home = ReactRedux.connect(
    (state, ownProps) => {
        return {
            lkey: state.router.location.key,
            geo: state.geo
        }
    }
)(React.createClass({
    displayName: 'Home',
    propTypes: {
        // mapped state
        geo: PropTypes.object,
        lkey: PropTypes.string,
        // router/redux
        pattern: PropTypes.string,
        pathname: PropTypes.string,
        isExact: PropTypes.bool,
        location: PropTypes.object,
        params: PropTypes.object,
        // redux
        dispatch: PropTypes.func
    },
    render() {
        console.log('component Home rendered, props:', this.props);
        return React.DOM.div(null, 'Home');
    }
}));

const One = React.createClass({
    displayName: 'One',
    render() {
        console.log('component One rendered, props:', this.props);
        return React.DOM.div(null, 'ONE');
    }
});
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
