# get-it-zipkin

Zipkin instrumentation middleware for [get-it](https://github.com/sanity-io/get-it)

## Installation

```
npm install --save get-it-zipkin
```

## Usage

```js
const {Tracer} = require('zipkin')
const getIt = require('get-it')
const zipkin = require('get-it-zipkin')

const tracer = new Tracer({
  ...
})

const request = getIt([
  zipkin({
    tracer: tracer,
    serviceName: 'calling-service',
    remoteServiceName: 'remote-service'
  })
])

request({url: 'https://some-remote-service/'})

// Remote service name can also be provided on a per-request basis:
request({url: 'https://some-other-service/', remoteServiceName: 'someOtherService'})
```

## License

MIT-licensed. See LICENSE.
