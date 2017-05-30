import React, { Component } from 'react'

import { setFilter } from '../../flows/filter'
import { pushAlternating } from '../../common/all'
import { executePageScript } from './utils'

const PAGE_SCRIPT = `
    (function() {
        var SHUTDOWN_TIMEOUT;
        window.addEventListener('message', function(e) {
            switch (e.data) {
                case '~ADDON_SHUTDOWN_WAR~-from-frame':
                        console.log('ext is still alive');
                        clearTimeout(SHUTDOWN_TIMEOUT);
                        setTimeout(didExtensionShutdown, 1000);
                    break;
                // no-default
            }
        }, 'message');

        function didExtensionShutdown() {
            window.postMessage('~ADDON_SHUTDOWN_WAR~-from-page', '*');
            SHUTDOWN_TIMEOUT = setTimeout(extensionShutdown, 1000);
        }

        function extensionShutdown() {
            console.log('EXTENSION DID SHUTDOWN!!');
            var root = document.getElementById('~ADDON_ID~');
            root.parentNode.removeChild(root);
        }

        didExtensionShutdown();
    })();
`;

class ContentScriptElement extends Component {
    componentDidMount() {
        executePageScript({ code:PAGE_SCRIPT });
        window.addEventListener('message', function(e) {
            switch (e.data) {
                case '~ADDON_SHUTDOWN_WAR~-from-page':
                        window.postMessage('~ADDON_SHUTDOWN_WAR~-from-frame', '*');
                    break;
                // no-default
            }
        }, 'message');
    }
    render() {
        let { filter:selected_filter, dispatch } = this.props;
        return (
            <div>
                <div>
                    Visibility: <span>{selected_filter}</span>
                </div>
                <div>
                    { pushAlternating(['PENDING', 'DONE', 'ALL'].map(filter => <Filter filter={filter} selected_filter={selected_filter} dispatch={dispatch} />), <span> | </span>) }
                </div>
            </div>
        )
    }
}

class Filter extends Component {
    /* props
        filter: PropTypes.string.isRequired,
        dispatch: PropTypes.func.isRequired,
        selected_filter: PropTypes.string.isRequired
    */
    setFilter = e => {
        let { filter, dispatch } = this.props;
        e.preventDefault();
        dispatch(setFilter(filter));
    }
    render() {
        let { filter, selected_filter } = this.props;

        return (
            <span>
                { filter === selected_filter && filter }
                { filter !== selected_filter && <a href="#" onClick={this.setFilter}>{filter}</a> }
            </span>
        )
    }
}

export default ContentScriptElement