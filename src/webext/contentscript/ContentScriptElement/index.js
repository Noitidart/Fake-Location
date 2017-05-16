import React, { Component, PropTypes } from 'react'

import BrowserAction from './BrowserAction'

export default class BackgroundElement extends Component {
    static propTypes = {
        core: PropTypes.object,
        browser_action: PropTypes.object,
        dispatch: PropTypes.func.isRequired
    }
    render() {
        console.log('in renderof BackgroundElement');
        let { browser_action, dispatch } = this.props;
        return (
            <div>
                <BrowserAction {...browser_action} dispatch={dispatch} />
            </div>
        )
    }
}