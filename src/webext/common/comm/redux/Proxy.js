import React, { Component, PropTypes } from 'react'

// Proxy is only rendered in html DOM so window exists for sure

export default class Proxy extends Component {
    static propTypes = {
        Component: React.Component,
        id: PropTypes.string,
        setSetState: PropTypes.func.isRequired,
        dispatch: PropTypes.func.isRequired
    }
    mounted = false
    initialState = {}
    componentDidMount() {
        this.mounted = true;
        let { setSetState } = this.props;
        setSetState(this.setState.bind(this));
    }
    render() {
        let { Component, dispatch } = this.props;
        let state = this.state;
        if (!this.mounted) {
            // because on mount, state has not yet been received, so dont render
            return <span />;
        } else {
            return <Component {...state} dispatch={dispatch} />
        }
    }
}