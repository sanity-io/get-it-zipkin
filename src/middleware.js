const objectAssign = require('object-assign')
const {HttpHeaders, Annotation} = require('zipkin')

module.exports = (opts = {}) => {
  if (!opts || !opts.tracer || typeof opts.tracer.scoped !== 'function') {
    throw new Error('get-it-zipkin requires a `tracer` option')
  }

  const serviceName = opts.serviceName || 'unknown'
  const {remoteServiceName, tracer} = opts

  return {
    processOptions: options => {
      tracer.scoped(() => {
        tracer.setId(tracer.createChildId())

        const traceId = tracer.id
        const remoteService = options.remoteServiceName || remoteServiceName

        tracer.recordServiceName(serviceName)
        tracer.recordRpc(options.method.toUpperCase())
        tracer.recordBinary('http.url', options.url)
        tracer.recordAnnotation(new Annotation.ClientSend())

        if (remoteService) {
          tracer.recordAnnotation(new Annotation.ServerAddr({
            serviceName: remoteService
          }))
        }

        const traceHeaders = getHeaders(traceId)

        const existing = options.headers || {}
        options.headers = objectAssign({}, existing, traceHeaders)
        options.traceId = traceId
      })

      return options
    },

    onResponse: (res, context) => {
      tracer.scoped(() => {
        tracer.setId(context.options.traceId)
        tracer.recordBinary('http.status_code', res.statusCode.toString())
        tracer.recordAnnotation(new Annotation.ClientRecv())
      })

      return res
    },

    onError: (err, context) => {
      tracer.scoped(() => {
        tracer.setId(context.options.traceId)
        tracer.recordBinary('request.error', err.toString())
        tracer.recordAnnotation(new Annotation.ClientRecv())
      })

      return err
    }
  }
}

function getHeaders(traceId) {
  const headers = {}

  headers[HttpHeaders.TraceId] = traceId.traceId
  headers[HttpHeaders.SpanId] = traceId.spanId

  traceId._parentId.ifPresent(psid => {
    headers[HttpHeaders.ParentSpanId] = psid
  })

  traceId.sampled.ifPresent(sampled => {
    headers[HttpHeaders.Sampled] = sampled ? '1' : '0'
  })

  return headers
}
