// ACTIONS and REDUCER
const ADD_ELEMENT = 'ADD_ELEMENT';
export function addElement(id, wanted, setState) {
    // NOTE: id must be a string because i use it as a react key crossfile-link3138470
    // wanted array of dotpaths, to deepAccessUsingString on redux store/state
    return {
        type: ADD_ELEMENT,
        id,
        wanted,
        setState
    }
}

const REMOVE_ELEMENT = 'REMOVE_ELEMENT';
export function removeElement(id) {
    return {
        type: REMOVE_ELEMENT,
        id
    }
}

export default function elements(state=[], action) {
    let type;
    ({type, ...action} = action);
    switch(type) {
        case ADD_ELEMENT: {
            let element = action;
            return [...state, element];
        }
        case REMOVE_ELEMENT: {
            let { id } = action;
            return state.filter(element => element.id !== id);
        }
        default:
            return state;
    }
}