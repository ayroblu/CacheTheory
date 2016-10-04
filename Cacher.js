// rules of caching
// 1. run func
// 2. if key in store, don't run func
// 3. if key is stale, don't run func
//
//  ----
//  SPEC
//  ----
//  #Define some rules -> set flags
//  rules
//    fastest: Simultaneous cache + origin, return first result
//    originFirst: get from origin, if fail then from cache
//    cacheFirst: get from cache first, if cache miss, then from origin
//    cacheOnly: get from cache only
//    originOnly: get from origin only (may as well not use Cacher)
//  getData
//    # get from rules (config)
//  getDataFromCache
//    cache.get(key)
//  getDataFromOrigin
//    fetch('/url').then(resolve).catch(reject)
//
//  TODO:
//  What about cache limiting? So like limit to 100MB or 100 items etc? Time stamp based?
//    
//  --------------
//  Implementation
//  --------------
//  So the thing here is that we're going to throw some promises around
//

// Sorry, need this for promise states and doing promise streams
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
      var p = this.getFulfilledPromise()
      return {value: result, promise: this.run()}
    }).catch(err=>{
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

/**
 * Cacher theoretical implementation
 * config options = {
 *   rule: 'fastest' | 'originFirst' | 'cacheFirst' | 'cacheOnly' | 'networkOnly'
 * }
 */
class Cacher {
  constructor(iStore, config={}){
    this.iStore = iStore;
    this.config = config;
  }
  /**
   * return promise
   */
  getData(key, func, options={}){ //public
    var config = Object.assign({}, this.config, options)

    // here in lies my problem
    // - total miss: throw an error (promise style) meaning reject
    // - return just data or return object with data + metadata? (pass flag for option/different methods?)
    // - Multiple data returns - cache + origin
    //   - err - return {data: data, nextCall: promise}
    //   - So the trick is you return the data, then give the user the option to return the promise func as nextCall, and bind another then
    // - perform based on rules, e.g. cacheFirst is getDataFromCache->catch->getDataFromOrigin
    
    // example cache first implementation:
    return new Promise((resolve, reject)=>{
      this.getDataFromCache(key).then(resolve).catch(err=>{
        if (err) {
          reject(err)
        } else {
          this.getDataFromOrigin(key, func).then(resolve).catch(reject)
        }
      })
    })
    
    // example fastest implementation
    var promises = [
      new Promise((resolve, reject)=>{
        this.getDataFromCache(key).then(result=>{
          // awesome got cache value, resolve
          resolve(result)
        }).catch(err=>{
          reject(err)
          // cache miss, wait for the network
        })
      })
    , new Promise((resolve, reject)=>{
        this.getDataFromOrigin(key).then(result=>{
          resolve(result)
        }).catch(err=>{
          reject(err)
        })
      })
    ]
    var promiseStream = new PromiseStream(promises)
    return promiseStream.run()
  }
  /**
   * return promise
   */
  getDataFromCache(key){
    return iStore.get(key)
  }
  /**
   * return promise
   */
  getDataFromOrigin(key, promise){
    // expecting a promise
    return promise
  }
  /**
   * return promise
   */
  setData(key, data){
    if (!data){
      throw new Error("No data?");
    }
    iStore.set(key, {metadata: this.getMetaData(), data: data}, isSuccess=>{ // should handle error...
      if (!this.config.dontWaitForSave)
        cb(data);
    })
    if (this.config.dontWaitForSave)
      cb(data)
  }
  errorHandler(err){
    console.error('Cacher error:', err)
  }
}
class IStore {
  constructor(){
    this.store = {}
  }
  // actually, do I need this cause usually a get from store is sufficient... What's the best way to detect a cache miss
  storeHas(key){ //extend
    return new Promise((resolve, reject)=>{
      if (this.store.hasOwnProperty(key) && this.store[key].data !== undefined) {
        resolve()
      } else {
        reject()
      }
    })
  }
  get(key){
    return new Promise((resolve, reject)=>{
      if (this.store.hasOwnProperty(key) && this.store[key].data !== undefined) {
        resolve(this.store[key].data)
      } else {
        reject()
      }
    })
  }
  set(key, data){ //extend
    new Promise((resolve, reject)=>{
      this.store[key] = {
        lastUpdated: new Date()
      , data: data
      }
      resolve()
    })
  }
}

function implementation(){
  //Example implementation
  var store = new IStore()
  var cacher = new Cacher(store)
  var promise = cacher.getData('key', curl)
  promise.then(res=>{
    console.log('first: ', res)
    return res.promise
  }).then(res=>{
    console.log('second: ', res)
  }).catch(err=>{
    console.error('rrrrerrr',err)
  })
}
implementation()
