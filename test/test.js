const {Tracer, ExplicitContext} = require('zipkin')
const {describe, before, after, it} = require('mocha')
const chai = require('chai')
const express = require('express')
const sinon = require('sinon')
const getIt = require('get-it')
const debug = require('get-it/lib/middleware/debug')
const promise = require('get-it/lib/middleware/promise')
const jsonResponse = require('get-it/lib/middleware/jsonResponse')
const zipkin = require('../src/middleware')

const expect = chai.expect
chai.config.includeStack = true

const middleware = opts => [
  debug({verbose: true}),
  promise(),
  jsonResponse(),
  zipkin(opts)
]

describe('get-it-zipkin', () => {
  before(function (done) {
    const app = express()
    app.post('/user', (req, res) => res.status(202).json({
      traceId: req.header('X-B3-TraceId') || '?',
      spanId: req.header('X-B3-SpanId') || '?'
    }))
    app.get('/err', (req, res) => res.destroy('ECONNREFUSED'))
    this.server = app.listen(0, () => {
      this.port = this.server.address().port
      done()
    })
  })

  after(function (done) {
    this.server.close(done)
  })

  it('checks for valid tracer', () => {
    expect(() => getIt(middleware({tracer: null}))).to.throw(/requires a `tracer` option/)
    expect(() => getIt(middleware({tracer: {}}))).to.throw(/requires a `tracer` option/)
  })

  it('should add instrumentation to "get-it"', function (done) {
    const record = sinon.spy()
    const recorder = {record}
    const ctxImpl = new ExplicitContext()
    const tracer = new Tracer({recorder, ctxImpl})

    const request = getIt(middleware({tracer, remoteServiceName: 'callee', serviceName: 'caller'}))

    ctxImpl.scoped(() => {
      const id = tracer.createChildId()
      tracer.setId(id)

      const url = `http://127.0.0.1:${this.port}/user`
      request({url, method: 'post'}).then(res => {
        const data = res.body
        const annotations = record.args.map(args => args[0])

        // All annotations should have the same trace id and span id
        const traceId = annotations[0].traceId.traceId
        const spanId = annotations[0].traceId.spanId
        annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId))
        annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId))

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName')
        expect(annotations[0].annotation.serviceName).to.equal('caller')

        expect(annotations[1].annotation.annotationType).to.equal('Rpc')
        expect(annotations[1].annotation.name).to.equal('POST')

        expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[2].annotation.key).to.equal('http.url')
        expect(annotations[2].annotation.value).to.equal(url)

        expect(annotations[3].annotation.annotationType).to.equal('ClientSend')

        expect(annotations[4].annotation.annotationType).to.equal('ServerAddr')
        expect(annotations[4].annotation.serviceName).to.equal('callee')

        expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[5].annotation.key).to.equal('http.status_code')
        expect(annotations[5].annotation.value).to.equal('202')

        expect(annotations[6].annotation.annotationType).to.equal('ClientRecv')

        const traceIdOnServer = data.traceId
        expect(traceIdOnServer).to.equal(traceId)

        const spanIdOnServer = data.spanId
        expect(spanIdOnServer).to.equal(spanId)
      })
      .then(done)
      .catch(done)
    })
  })

  it('skips ServerAddr annotation if remote service name is not given', function (done) {
    const record = sinon.spy()
    const recorder = {record}
    const ctxImpl = new ExplicitContext()
    const tracer = new Tracer({recorder, ctxImpl})

    const request = getIt(middleware({tracer, serviceName: 'caller'}))

    ctxImpl.scoped(() => {
      const id = tracer.createChildId()
      tracer.setId(id)

      const url = `http://127.0.0.1:${this.port}/user`
      request({url, method: 'post'}).then(res => {
        const data = res.body
        const annotations = record.args.map(args => args[0])

        // All annotations should have the same trace id and span id
        const traceId = annotations[0].traceId.traceId
        const spanId = annotations[0].traceId.spanId
        annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId))
        annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId))

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName')
        expect(annotations[0].annotation.serviceName).to.equal('caller')

        expect(annotations[1].annotation.annotationType).to.equal('Rpc')
        expect(annotations[1].annotation.name).to.equal('POST')

        expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[2].annotation.key).to.equal('http.url')
        expect(annotations[2].annotation.value).to.equal(url)

        expect(annotations[3].annotation.annotationType).to.equal('ClientSend')

        expect(annotations[4].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[4].annotation.key).to.equal('http.status_code')
        expect(annotations[4].annotation.value).to.equal('202')

        expect(annotations[5].annotation.annotationType).to.equal('ClientRecv')

        const traceIdOnServer = data.traceId
        expect(traceIdOnServer).to.equal(traceId)

        const spanIdOnServer = data.spanId
        expect(spanIdOnServer).to.equal(spanId)
      })
      .then(done)
      .catch(done)
    })
  })

  it('allows remote service name to be provided through request options', function (done) {
    const record = sinon.spy()
    const recorder = {record}
    const ctxImpl = new ExplicitContext()
    const tracer = new Tracer({recorder, ctxImpl})

    const request = getIt(middleware({tracer, serviceName: 'caller'}))

    ctxImpl.scoped(() => {
      const id = tracer.createChildId()
      tracer.setId(id)

      const url = `http://127.0.0.1:${this.port}/user`
      request({url, method: 'post', remoteServiceName: 'someService'}).then(res => {
        const data = res.body
        const annotations = record.args.map(args => args[0])

        // All annotations should have the same trace id and span id
        const traceId = annotations[0].traceId.traceId
        const spanId = annotations[0].traceId.spanId
        annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId))
        annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId))

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName')
        expect(annotations[0].annotation.serviceName).to.equal('caller')

        expect(annotations[1].annotation.annotationType).to.equal('Rpc')
        expect(annotations[1].annotation.name).to.equal('POST')

        expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[2].annotation.key).to.equal('http.url')
        expect(annotations[2].annotation.value).to.equal(url)

        expect(annotations[4].annotation.annotationType).to.equal('ServerAddr')
        expect(annotations[4].annotation.serviceName).to.equal('someService')

        expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[5].annotation.key).to.equal('http.status_code')
        expect(annotations[5].annotation.value).to.equal('202')

        expect(annotations[6].annotation.annotationType).to.equal('ClientRecv')

        const traceIdOnServer = data.traceId
        expect(traceIdOnServer).to.equal(traceId)

        const spanIdOnServer = data.spanId
        expect(spanIdOnServer).to.equal(spanId)
      })
      .then(done)
      .catch(done)
    })
  })

  it('should add error instrumentation to "get-it"', function (done) {
    const record = sinon.spy()
    const recorder = {record}
    const ctxImpl = new ExplicitContext()
    const tracer = new Tracer({recorder, ctxImpl})

    const request = getIt(middleware({tracer, remoteServiceName: 'callee', serviceName: 'caller'}))

    ctxImpl.scoped(() => {
      const id = tracer.createChildId()
      tracer.setId(id)

      const url = `http://127.0.0.1:${this.port}/err`
      request({url}).catch(err => {
        const annotations = record.args.map(args => args[0])

        // All annotations should have the same trace id and span id
        const traceId = annotations[0].traceId.traceId
        const spanId = annotations[0].traceId.spanId
        annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId))
        annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId))

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName')
        expect(annotations[0].annotation.serviceName).to.equal('caller')

        expect(annotations[1].annotation.annotationType).to.equal('Rpc')
        expect(annotations[1].annotation.name).to.equal('GET')

        expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[2].annotation.key).to.equal('http.url')
        expect(annotations[2].annotation.value).to.equal(url)

        expect(annotations[3].annotation.annotationType).to.equal('ClientSend')

        expect(annotations[4].annotation.annotationType).to.equal('ServerAddr')
        expect(annotations[4].annotation.serviceName).to.equal('callee')

        expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation')
        expect(annotations[5].annotation.key).to.equal('request.error')
        expect(annotations[5].annotation.value).to.equal(err.toString())

        expect(annotations[6].annotation.annotationType).to.equal('ClientRecv')
      })
      .then(done)
      .catch(done)
    })
  })
})
