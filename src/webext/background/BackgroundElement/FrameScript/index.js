import React, { Component } from 'react'
import shallowCompare from 'react-addons-shallow-compare'

class FrameScript extends Component {
    /* props
        // matches - array - NO_CHANGE_AFTER_MOUNT currently all urls are matched
        // matchAboutBlank - NO_CHANGE_AFTER_MOUNT currently ignored
        config - JSON serializable object
        file - WEB_ACCESSIBLE_RESOURCES_REQUIRED - NO_CHANGE_AFTER_MOUNT injected to each frame
        updateCode - triggered when config is changed
        unmountCode -
        // runAt? - NO_CHANGE_AFTER_MOUNT currently only "document_end" which is DOMContentLoaded per MDN https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/content_scripts
    */
    static defaultProps = {
        matchAboutBlank: true,
        runAt: 'document_end' // DOMContentLoaded
    }
    componentDidUpdate(props_old) {
        // check if config changed
        const { config } = this.props;
        const { config:config_old } = props_old;
        console.log('FrameScript updated');
        if (shallowCompare({props:{config}}, {config:config_old})) {
            console.log('config updated in FrameScript');
            this.updateConfigInAllTabs();
        }
    }
    uninitFrame(tab, frame) {
        console.error('in uninitFrame');
        const { id:tabId } = tab;
        const { frameId } = frame;
        const { unmountCode, runAt, matchAboutBlank, } = this.props;
        console.error('yes in uninitFrame and has unmountCode:', unmountCode)
        if (unmountCode) {
            extension.tabs.executeScript(tabId, {
                frameId,
                code: unmountCode,
                matchAboutBlank,
                runAt
            });
        }
    }
    async updateConfigInAllTabs() {
        const tabs = await getMatchingTabs();
        console.log('got tabs:', tabs);
        tabs.forEach( tab => {
            console.log('tab:', tab);
            iterateFrames(tab, async (tab, frame) => {
                if(await hasDOMContentLoaded(tab, frame)) {
                    this.updateConfigInFrame(tab, frame);
                }
            })
        });
    }
    updateConfigInFrame(tab, frame) {
        // only triggered when config updates, so config is there for sure
        const { id:tabId } = tab;
        const { frameId } = frame;
        const { config, matchAboutBlank, runAt } = this.props;

        extension.tabs.executeScript(tabId, {
            frameId,
            code: `config = ${JSON.stringify(config)}; handleConfigUpdate()`,
            matchAboutBlank,
            runAt
        });
    }
    async initFrame(tab, frame) {
        const { id:tabId } = tab;
        const { frameId } = frame;
        const { config, file, matchAboutBlank, runAt } = this.props;
        if (config) {
            // https://stackoverflow.com/a/17591250/1828637
            await extensiona('tabs.executeScript', tabId, {
                frameId,
                code: 'var config = ' + JSON.stringify(config), // crossfile-link270918
                matchAboutBlank,
                runAt
            });
        }

        await extensiona('tabs.executeScript', tabId, {
            frameId,
            // in firefox
                // works - extension.extension.getURL(file)
                // works - relative-from-root (/inject/inject.bundle.js)
                // not - ./inject/inject.bundle.js
                // not - inject/inject.bundle.js
            // in chrome
                // not - extension.extension.getURL(file)
                // works - relative-from-root (/inject/inject.bundle.js)
                // not - ./inject/inject.bundle.js
                // works - inject/inject.bundle.js
            file,
            matchAboutBlank,
            runAt
        });
    }
    handleWebNavLoad = details => {
        const { tabId, frameId } = details;
        this.initFrame({id:tabId}, {frameId})
    }
    async componentDidMount() {
        // TODO: to support document_idle i would do webNavigation.onComplete I think
        extension.webNavigation.onDOMContentLoaded.addListener(this.handleWebNavLoad);

        const tabs = await getMatchingTabs();
        console.log('got tabs:', tabs);
        tabs.forEach( tab => {
            console.log('tab:', tab);
            iterateFrames(tab, async (tab, frame) => {
                if(await hasDOMContentLoaded(tab, frame)) {
                    this.initFrame(tab, frame);
                }
            })
        });

    }
    async componentWillUnmount() {
        console.error('UNMOUNTING FRAMESCRIPT');
        extension.webNavigation.onDOMContentLoaded.removeListener(this.handleWebNavLoad);

        const { unmountCode } = this.props;
        if (unmountCode) {
            console.error('yes has unmountCode it is:', unmountCode);
            try {
            console.log('tabs pre:', await getMatchingTabs());
            } catch(ex) {
                console.error('failed tabs pre:', ex);
            }
            const tabs = await getMatchingTabs();
            console.log('tabs:', tabs);
            tabs.forEach( tab => {
                console.log('tab:', tab);
                iterateFrames(tab, async (tab, frame) => {
                    console.log('in frame iterate');
                    this.uninitFrame(tab, frame);
                })
            });
        }
    }
    render() {
        return <div />;
    }
}

async function getMatchingTabs(matches=['<all_urls>']) {
    // based on props, gets the matching tabs
    // currently just gets all
    return await extensiona('tabs.query', { url:matches });
}

async function iterateFrames(tab, executor) {
    const { id:tabId } = tab;
    const frames = await extensiona('webNavigation.getAllFrames', { tabId });
    for (const frame of frames) {
        executor(tab, frame);
    }
}


async function hasDOMContentLoaded(tab, frame) {
    // for frame
    const { id:tabId } = tab;
    const { frameId } = frame;
    return await extensiona('tabs.executeScript', tabId, {
        frameId,
        code: `document.readyState === 'interactive'`,
    });
}

export default FrameScript