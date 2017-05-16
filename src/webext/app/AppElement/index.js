import React, { Component, PropTypes } from 'react'

import { setFilter } from '../../flows/filter'
import { pushAlternating } from '../../common/all'

export default class AppElement extends Component {
    static propTypes = {
        core: PropTypes.object,
        todos: PropTypes.array,
        filter: PropTypes.string,
        dispatch: PropTypes.func.isRequired
    }
    render() {
        let { filter:selected_filter, dispatch } = this.props;
        return (
            <div>
                <div>
                    Visibility: <span>{selected_filter}</span>
                </div>
                <div>
                    { pushAlternating(['PENDING', 'DONE', 'ALL'].map(filter => <Filter filter={filter} selected_filter={selected_filter} dispatch={dispatch} />), <span> | </span>) }
                </div>
            </div>
        )
    }
}

class Filter extends Component {
    static propTypes = {
        filter: PropTypes.string.isRequired,
        dispatch: PropTypes.func.isRequired,
        selected_filter: PropTypes.string.isRequired
    }
    setFilter = e => {
        let { filter, dispatch } = this.props;
        e.preventDefault();
        dispatch(setFilter(filter));
    }
    render() {
        let { filter, selected_filter } = this.props;

        return (
            <span>
                { filter === selected_filter && filter }
                { filter !== selected_filter && <a href="#" onClick={this.setFilter}>{filter}</a> }
            </span>
        )
    }
}