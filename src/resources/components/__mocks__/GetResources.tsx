import React, {PureComponent, ReactNode} from 'react'

export class GetResources extends PureComponent<Props> {
  render() {
    return <>{this.props.children}</>
  }
}
