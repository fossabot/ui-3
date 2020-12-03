// @ts-nocheck
import React from 'react'
import {createStore} from 'redux'
import {fireEvent, screen, waitFor} from '@testing-library/react'

// jest.mock('react-redux', () => {
//   return {
//     connect: () => {
//       return component => {
//         return component
//       }
//     },
//     // Provider: ({ children }) => children
//   }
// })

jest.mock('src/templates/api', () => {
  return {
    fetchStacks: jest.fn(() => {
      return []
    }),
  }
})

jest.mock('src/shared/actions/notifications', () => {
  return {
    notify: jest.fn(() => {
      return {
        type: 'PUBLISH_NOTIFICATION',
        payload: {notification: 'shut up jerk'},
      }
    }),
  }
})

import {getStore} from 'src/store/configureStore'

import {templatesReducer} from 'src/templates/reducers/index'

import {renderWithReduxAndRouter} from 'src/mockState'
import {CommunityTemplatesIndex} from 'src/templates/containers/CommunityTemplatesIndex'
import {withRouterProps} from 'mocks/dummyData'

import {mockAppState} from 'src/mockAppState'

import {RemoteDataState} from 'src/types'

import {communityTemplateUnsupportedFormatError} from 'src/shared/copy/notifications'

import {notify} from 'src/shared/actions/notifications'

const props = {
  ...withRouterProps,
  org: 'ORG',
  stagedTemplateUrl: null,
}

const setup = () => {
  const templatesStore = createStore(templatesReducer)

  return renderWithReduxAndRouter(
    <CommunityTemplatesIndex {...props} />,
    _fakeLocalStorage => {
      const appState = {...mockAppState}
      appState.resources.templates = templatesStore.getState()
      return appState
    }
  )
}

describe('the Community Templates index', () => {
  describe('starting the template install process', () => {
    it('notifies the user when there is no template url to lookup', () => {
      const {getByTitle, store} = setup()
      const templateButton = getByTitle('Lookup Template')

      fireEvent.click(templateButton)

      const [notifyCall] = notify.mock.calls
      const [notifyActionCreator] = notifyCall
      console.log(notifyActionCreator)
      expect(notifyActionCreator).toEqual(
        communityTemplateUnsupportedFormatError()
      )
    })
  })
})
