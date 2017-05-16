import { getBrowser } from '../common/window'

const initial = {
	self: {
		id: '~ADDON_ID~',
		version: '~ADDON_VERSION~',
        locales: ['en_US']
        // // startup: string; enum[STARTUP, UPGRADE, DOWNGRADE, INSTALL] - startup_reason
	},
    browser: getBrowser()
}

export default function core(state=initial, action) {
    let type;
    ({type, ...action} = action);
    switch(type) {
        default: return state;
    }
}