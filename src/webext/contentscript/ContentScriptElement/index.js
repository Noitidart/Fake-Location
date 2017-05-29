import React, { Component } from 'react'

export default class ContentScriptElement extends Component {
    /* props
    dispatch
    core
    */
    render() {
        console.log('in renderof ContentScriptElement');
        const { core } = this.props;
        return (
            <div>
                ContentScript hiiiiiiiiiiii {JSON.stringify(core)}
            </div>
        )
    }
}