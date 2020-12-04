// @ts-nocheck
import React from 'react'
import {createStore} from 'redux'
import {fireEvent, screen, waitFor} from '@testing-library/react'
import {arrayOfOrgs} from 'src/schemas'
import {Organization, RemoteDataState, OrgEntities} from 'src/types'
import {normalize} from 'normalizr'

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

jest.mock('src/cloud/utils/reporting', () => {
  return {
    event: jest.fn(),
  }
})

import {getStore} from 'src/store/configureStore'
import {event} from 'src/cloud/utils/reporting'

import {templatesReducer} from 'src/templates/reducers/index'

import {renderWithReduxAndRouter} from 'src/mockState'
import {CommunityTemplatesIndex} from 'src/templates/containers/CommunityTemplatesIndex'
import {withRouterProps} from 'mocks/dummyData'

import {mockAppState} from 'src/mockAppState'

import {RemoteDataState} from 'src/types'

import {communityTemplateUnsupportedFormatError} from 'src/shared/copy/notifications'

import {notify} from 'src/shared/actions/notifications'

const defaultProps = {
  ...withRouterProps,
  org: 'ORG',
}

const setup = (props = defaultProps) => {
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
  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('starting the template install process', () => {
    it('notifies the user when there is no template url to lookup', () => {
      const {getByTitle, store} = setup()
      const templateButton = getByTitle('Lookup Template')

      fireEvent.click(templateButton)

      const [notifyCall] = notify.mock.calls
      const [notifyMessage] = notifyCall
      expect(notifyMessage).toEqual(communityTemplateUnsupportedFormatError())
    })
    it('attempts to open the install overlay', () => {
      const {getByTitle, store} = setup()

      store.dispatch({
        type: 'SET_ORG',
        org: {name: 'zoe', id: '12345'},
      })
      const orgs = [{name: 'zoe', id: '12345'}]
      const organizations = normalize<Organization, OrgEntities, string[]>(
        orgs,
        arrayOfOrgs
      )
      store.dispatch({
        type: 'SET_ORGS',
        schema: organizations,
        status: RemoteDataState.Done,
      })

      store.dispatch({
        type: 'SET_STAGED_TEMPLATE_URL',
        templateUrl: 'http://www.example.com',
      })

      const templateButton = getByTitle('Lookup Template')

      fireEvent.click(templateButton)
      const [eventCall] = event.mock.calls
      console.log(eventCall)
    })
  })
})
