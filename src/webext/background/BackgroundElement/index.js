import React, { Component, PropTypes } from 'react'

import BrowserAction from './BrowserAction'
import FrameScript from './FrameScript'

export default class BackgroundElement extends Component {
    static propTypes = {
        core: PropTypes.object,
        browser_action: PropTypes.object,
        dispatch: PropTypes.func.isRequired
    }
    render() {
        console.log(`extension.extension.getURL('inject/index.bundle.js')`, extension.extension.getURL('inject/index.bundle.js'));
        console.log('in renderof BackgroundElement');
        let { browser_action, dispatch } = this.props;
        return (
            <div>
                <BrowserAction {...browser_action} dispatch={dispatch} />
                <FrameScript file="/inject/index.bundle.js" unmountCode="unregister()" updateCode="handleConfigUpdate()" />
            </div>
        )
    }
}