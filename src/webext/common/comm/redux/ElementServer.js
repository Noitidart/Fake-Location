import React, { Component, PropTypes } from 'react'
import { connect } from 'react-redux'

import { deepAccessUsingString } from '../../all'

const DOTPATH_AS_PATT = /(.+) as (.+)$/m;
function buildWantedState(wanted, state) {
    console.log('state:', state, 'wanted:', wanted);
    let wanted_state = {};
    for (let dotpath of wanted) {
        let name;
        if (DOTPATH_AS_PATT.test(dotpath)) {
            // ([, dotpath, name] = DOTPATH_AS_PATT.exec(dotpath));
            let matches = DOTPATH_AS_PATT.exec(dotpath);
            dotpath = matches[1];
            name = matches[2];
        } else {
            name = dotpath.split('.');
            name = name[name.length-1];
        }
        wanted_state[name] = deepAccessUsingString(state, dotpath, 'THROW');
    }
    return wanted_state;
}

const ElementServer = connect(
    function(state, ownProps) {
        let { wanted } = ownProps;
        return {
            state: buildWantedState(wanted, state)
        }
    }
)(class ElementServerClass extends Component {
    static propTypes = {
        id: PropTypes.string.isRequired,
        wanted: PropTypes.arrayOf(PropTypes.string).isRequired,
        setState: PropTypes.func.isRequired,
        state: PropTypes.any.isRequired // supplied by the redux.connect
    }
    componentDidUpdate() {
        let { state, setState } = this.props;
        console.log('ElemenServer: ok something changed so doing setState');
        setState(state);
    }
    componentDidMount() {
        this.componentDidUpdate();
    }
    render() {
        return <div />;
    }
});

export default ElementServer;