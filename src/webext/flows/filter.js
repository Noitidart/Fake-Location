const SET_FILTER = 'SET_FILTER'
const FILTERS = {
    ALL: 'ALL',
    DONE: 'DONE',
    PENDING: 'PENDING'
}
export function setFilter(filter) {
    if (!(filter in FILTERS)) throw new Error('Invalid filter!');
    return {
        type: SET_FILTER,
        filter
    }
}

export default function filter(state=FILTERS.ALL, action) {
    let type;
    ({type, ...action} = action);
    switch(type) {
        case SET_FILTER:
            return action.filter;
        default:
            return state;
    }
}