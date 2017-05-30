import React, { Component } from 'react'

import { setFilter } from '../../flows/filter'
import { pushAlternating } from '../../common/all'
import { executePageScript } from './utils'

const PAGE_SCRIPT = `
    function didExtensionShutdown() {
        var url = '${extension.extension.getURL('~ADDON_SHUTDOWN_WAR~')}';
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'text';

        xhr.addEventListener('load', function(e) {
            // addon is still alive, keep checking
            setTimeout(didExtensionShutdown, 1000);
        }, false);

        xhr.addEventListener('error', function(e) {
            // ok it shutdown
            console.log(url, 'extension shutdown!, error:', e);
            var root = document.getElementById('~ADDON_ID~');
            root.parentNode.removeChild(root);
        }, false);

        xhr.open('GET', url);
        xhr.send();
    }

    didExtensionShutdown();
`;

class ContentScriptElement extends Component {
    componentDidMount() {
        executePageScript({ code:PAGE_SCRIPT });
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