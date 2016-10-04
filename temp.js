class PromiseStream {
  constructor(promises){
    this.promises = promises.map(p=>this.addPromiseState(p))
  }
  addPromiseState(promise){
    // Don't create a wrapper for promises that can already be queried.
    if (promise.isResolved) return promise

    var isFulfilled = false
      , isRejected = false

    // Observe the promise, saving the fulfillment in a closure scope.
    var result = promise.then(v=>{
      isFulfilled = true
      return v
    }, e=>{
      isRejected = true
      throw e
    });
    result.isFulfilled = ()=>isFulfilled
    result.isResolved = ()=>isFullfilled | isRejected
    result.isRejected = ()=>isRejected
    return result;
  }
  run(){
    this.promises = this.promises.filter(p=>!p.isFulfilled())
    if (!this.promises.length) return

    return Promise.race(this.promises).then(result=>{
      console.log('all good res:', result)
      var p = this.getFulfilledPromise()
      console.log('isFulfilled:', p.isFulfilled())
      return {value: result, promise: this.run()}
    }).catch(err=>{
      console.error('catch:', err)
      return {err: err, promise: this.run()}
    })
  }
  getFulfilledPromise(){
    var promises = this.promises.filter(p=>p.isFulfilled())
    if (promises.length >= 1){
      return promises[0]
    }
    return false
  }
}

var p1 = new Promise((resolve, reject)=>{
  setTimeout((arg)=>{
    resolve(arg)
  }, 1000, 'p1')
})
var p2 = new Promise((resolve, reject)=>{
  setTimeout(arg=>{
    resolve(arg)
  }, 2000, 'p2')
})

var promises = [p1, p2]
var promiseStream = new PromiseStream(promises)
var promise = promiseStream.run()
promise.then(res=>{
  console.log('first: ', res)
  return res.promise
}).then(res=>{
  console.log('second: ', res)
}).catch(err=>{
  console.error('rrrrerrr',err)
})
