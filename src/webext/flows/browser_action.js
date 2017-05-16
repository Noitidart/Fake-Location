const initial = {
    title: extension.i18n.getMessage('browseraction_title'),
    badgetxt: '55'
}

const SET_TITLE = 'SET_TITLE'
export const setTitle = title => ({ type:SET_TITLE, title })

const SET_BADGE_TEXT = 'SET_BADGE_TEXT'
export const setBadgeText = text => ({ type:SET_BADGE_TEXT, text })

const SET_BADGE_COLOR = 'SET_BADGE_COLOR'
export const setBadgeColor = color => ({ type:SET_BADGE_COLOR, color })

export default function browser_action(state=initial, action) {
    let type;
    ({type, ...action} = action);
    switch(type) {
        case SET_BADGE_TEXT: {
            let { text } = action;
            return { ...state, badgetxt:text }
        }
        case SET_BADGE_COLOR: {
            let { color } = action;
            return { ...state, badgecolor:color }
        }
        case SET_TITLE: {
            let { title } = action;
            return { ...state, title }
        }
        default:
            return state;
    }
}