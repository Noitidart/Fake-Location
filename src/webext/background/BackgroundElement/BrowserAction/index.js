import React, { Component, PropTypes } from 'react'

export default class BrowserAction extends Component {
    static propTypes = {
        dispatch: PropTypes.func.isRequired,
        tabid: PropTypes.number, // optional, if leave out, then it sets on default // TODO: not yet supported
        title: PropTypes.string.isRequired,
        badgecolor: PropTypes.string,
        badgetxt: PropTypes.string
    }
    static setTitle(title, tabid) {
        extension.browserAction.setTitle({ title, tabId:tabid })
    }
    static setBadgetxt(text, tabid) {
        extension.browserAction.setBadgeText({ text, tabId:tabid })
    }
    static setBadgecolor(color, tabid) {
        extension.browserAction.setBadgeBackgroundColor({ color, tabId:tabid })
    }
    static handleClick() {
        extension.tabs.create({ url:'/app/index.html' });
    }
    componentDidUpdate(propsold) {
        let { tabid, ...props } = this.props; // ...props are api setable props
        console.log('in componentDidUpdate of BrowserAction');
        for (let [prop, value] of Object.entries(props)) {
            let settername = 'set' + prop[0].toUpperCase() + prop.substr(1);
            if (settername in BrowserAction) {
                // it is an api settable prop
                let valueold = propsold[prop];
                if (valueold !== value) {
                    BrowserAction[settername](value, tabid);
                }
            } // else it is NOT an api settable prop
        }
    }
    componentDidMount() {
        extension.browserAction.onClicked.addListener(BrowserAction.handleClick);

        this.componentDidUpdate({});
    }
    render() {
        return <div />;
    }
}