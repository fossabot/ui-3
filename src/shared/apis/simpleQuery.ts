import {fromFlux, FromFluxResult} from '@influxdata/giraffe'
import {Query, Variable} from 'src/types'
import {API_BASE_PATH} from 'src/shared/constants'
import {asAssignment} from 'src/variables/selectors'
import {buildVarsOption} from 'src/variables/utils/buildVarsOption'
import {
  RATE_LIMIT_ERROR_STATUS,
  RATE_LIMIT_ERROR_TEXT,
} from 'src/cloud/constants'

interface NetworkErrorMessage {
  status: number
  message: string
  retry?: number
}

class NetworkError extends Error {
  status
  retry

  constructor(msg: NetworkErrorMessage) {
    super(`[${msg.status}]: ${msg.message}`)
    this.status = msg.status
    this.retry = msg.retry
  }
}

class RateError extends NetworkError {}

class CancelError extends NetworkError {
  constructor() {
    super({
      status: 499,
      message: 'Request canceled by user',
    })
  }
}

export {NetworkError, RateError, CancelError}

interface CancelPromise<T> extends Promise<T> {
  cancel: () => void
}

// NOTE: this is only to make types work and I hate it (alex)
function makeCancelable(
  promise: Promise<FromFluxResult>,
  controller: AbortController
): CancelPromise<FromFluxResult> {
  let localPromise = promise as CancelPromise<FromFluxResult>

  localPromise.cancel = () => controller.abort()

  return localPromise
}

export default (
  orgID: string,
  query: string,
  variables?: Variable[]
): CancelPromise<FromFluxResult> => {
  // TODO: make this configurable for multiple instances
  const url = `${API_BASE_PATH}api/v2/query?${new URLSearchParams({orgID})}`

  const headers = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip',
  }

  const body: Query = {
    query,
    extern: buildVarsOption([
      ...variables.map(variable => asAssignment(variable)),
    ]),
    dialect: {annotations: ['group', 'datatype', 'default']},
  }

  const controller = new AbortController()

  const request = fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller?.signal,
  })
    .then(response => {
      if (response.status === RATE_LIMIT_ERROR_STATUS) {
        const retryAfter = response.headers.get('Retry-After')

        throw new RateError({
          status: response.status,
          message: RATE_LIMIT_ERROR_TEXT,
          retry: retryAfter ? parseInt(retryAfter, 10) : null,
        })
      }

      if (response.status !== 200) {
        return response
          .text()
          .then(text => {
            if (text) {
              return text
            }

            const headerError = response.headers.get('x-influxdb-error')

            if (headerError) {
              return headerError
            }

            return 'Unknown Error'
          })
          .then(text => {
            throw new NetworkError({
              status: response.status,
              message: text,
            })
          })
      }

      if (response.body) {
        return (async () => {
          let data = ''
          const reader = response.body.getReader()
          let chunk: ReadableStreamReadResult<Uint8Array>

          do {
            chunk = await reader.read()

            // TODO: point this to a live / partial parser to reduce memory usage
            data += chunk.value
          } while (!chunk.done)

          return fromFlux(data)
        })()
      } else {
        return (async () => {
          const data = await response.text()
          return fromFlux(data)
        })()
      }
    })
    .catch(e =>
      e.name === 'AbortError'
        ? Promise.reject(new CancelError())
        : Promise.reject(e)
    )

  return makeCancelable(request, controller)
}
