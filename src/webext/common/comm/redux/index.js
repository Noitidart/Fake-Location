// TODO: figure out how to make redux-offline only persist some keys, like there is no reason to persist messages

import React, { Component, PropTypes } from 'react'
import { combineReducers, createStore } from 'redux'
import { render, unmountComponentAtNode } from 'react-dom'
import { Provider, connect } from 'react-redux'
// import { applyMiddleware, combineReducers, compose, createStore } from 'redux'
// import { offline } from 'redux-offline'
// import offlineConfigDefault from 'redux-offline/lib/defaults'
// import thunk from 'redux-thunk'


import elements from './elements'
import { removeElement, addElement } from './elements'

import ElementServer from './ElementServer'
import Proxy from './Proxy'

// App is server that all proxies connect to
const App = connect(
    function(state) {
        return {
            elements: state.elements
        }
    }
)(class AppClass extends Component {
    // crossfile-link3138470
    static propTypes = {
        elements: PropTypes.array
    }
    render() {
        let { elements } = this.props;
        return (
            <div>
                { elements.map(element => <ElementServer key={element.id} {...element} />) }
            </div>
        )
    }
});

// export function unmountProxiedElement(id, container) {
//     // TODO:
//     console.log('unmount element id:', id);

//     if (container) unmountComponentAtNode(container);
// }

function renderProxiedElement(callInReduxPath, component, container, wanted) {
    // this should imported and executed in the dom where we want to render the html element
    // if ReduxServer is in same scope, set callInReduxPath to gReduxServer
    // resolves with elementid - so dever can use with unmountProxiedElement(id)
    // component - react class
    // container - dom target - document.getElementById('root')
    // wanted - wanted state
    // store.dispatch(addElement('todo', component.name, wanted));

    let callInRedux;
    if (Array.isArray(callInReduxPath)) {
        let [callInReduxScope, server_name] = callInReduxPath;
        callInRedux = (method, ...args) => callInReduxScope(server_name + '.' + method, ...args);
    } else {
        // no need for comm, we are in same scope
        let server = callInReduxPath
        callInRedux = (method, ...args) => server[method](...args);
    }

    let resolveWithId;
    let promise = new Promise(resolve => {
        resolveWithId = resolve;
        promise = null;
    });

    let id; // element id
    let setState;

    const dispatch = function(action) {
        // TODO: NOTE: if there are keys which have data that can be transferred, it should be be in __XFER key in the object returned by the action declared in the files in ./flows/* ---- i might have to do a test in Comm sendMessage to test if the data in key marked for possible transferrable, is actually transferrable MAYBE im not sure, the browser might handle it, but if data is duplicated i should do the check
        callInRedux('dispatch', action);
    };

    const unmountProxiedElement = function(nounmount) {
        console.log('DOING unmountProxiedElement');
        dispatch(removeElement(id));
        if (!nounmount) unmountComponentAtNode(container);
    };

    const progressor = function(aArg) {
        let { __PROGRESS } = aArg;

        if (__PROGRESS) {
            let { state } = aArg;
            if (id === undefined) {
                id = aArg.id;
                const setSetState = aSetState => {
                    setState = aSetState;
                    setState(() => state);
                };
                render(<Proxy Component={component} id={id} setSetState={setSetState} dispatch={dispatch} />, container);
                resolveWithId(id);
            } else {
                setState(() => state);
            }
        } else {
            // unmounted - server was shutdown by unregister()
            console.log('ok unmounting in dom, aArg:', aArg);
            unmountComponentAtNode(container);
        }
    };

    if (Array.isArray(callInReduxPath)) {
        callInRedux('addElement', { wanted }, progressor);
    } else {
        // no need for comm, we are in same scope
        callInRedux('addElement', { wanted }, fakeprog => { fakeprog.__PROGRESS = 1; progressor(fakeprog); }).then(progressor); // the .then is so it unmounts, as addElement returns promise, to keep Comm aReportProgress alive
    }

    // window is defintiely available, as renderProxiedElement is only used in DOM
    window.addEventListener('unload', () => unmountProxiedElement(true), false);

    return promise;
}

export class Server {
    store = undefined
    nextelementid = 0
    constructor(reducers) {

        // this.store = createStore(reducer, undefined, compose(applyMiddleware(thunk), offline(offlineConfigDefault)));
        // this.store = createStore(combineReducers(reducers), undefined, compose(applyMiddleware(thunk), offline(offlineConfigDefault)));
        // this.store = createStore(combineReducers(reducers), undefined, applyMiddleware(thunk));
        this.store = createStore(combineReducers({ ...reducers, elements }));

        let container = document.createElement('div');
        container.classList.add('redux-server');
        document.body.appendChild(container);

        render(<Provider store={this.store}><App/></Provider>, container);
    }
    removeElement = {};
    addElement(aArg, aReportProgress, ...args) {
        console.log('in addElement, aArg:', aArg, 'aReportProgress:', aReportProgress, 'args:', args);
        const id = (this.nextelementid++).toString(); // toString because it is used as a key in react - crossfile-link3138470
        return new Promise( resolve => { // i need to return promise, because if it is Comm, a promise will keep it alive so it keeps responding to aReportProgress
            let { wanted } = aArg;
            const setState = state => aReportProgress({ id, state });
            this.store.dispatch(addElement(id, wanted, setState));

            this.removeElement[id] = () => resolve({destroyed:true});
        });
    }
    dispatch(aArg) {
        let action = aArg;
        this.store.dispatch(action);
    }
}

export default renderProxiedElement;