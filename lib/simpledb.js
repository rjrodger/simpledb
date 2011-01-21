/* Copyright (c) 2011 Richard Rodger */

var util = require('util')

// TODO remove
var eyes = require('eyes')

var aws = require('../../aws-lib/lib/aws.js')
//var aws = require('aws-lib')

var MARK = 'simpledb: '



/* Exponential back-off for Amazon requests.
 * Algorithm as per pseudo-code in SimpleDB Dev Guide 2009-04-15, page 56
 * fn:         your function, that calls simpledb
 * statuscb:   a callback function that get status notifications (optional)
 * maxtry:     the maximum number of request attempts, default=4
 * expbase:    exponent base, default=4
 * delaymin:   minimum delay in milliseconds, default=0
 * delayscale: millisecond multiplier for the exponential value
 * random:     random multiplier to the delay, default=true
 *
 * Callbacks:
 * fn(stop,tryI,delay)
 *   stop:  callback to halt retries
 *     done: true if done, so stop
 *     err:  err for statuscb, if any
 *   tryI:  try index, starts from 1
 *   delay: delay before this try
 *
 * statuscb(done,tryI,last,delay,err)
 *   done: boolean return value from your function 
 *   tryI:  try index, starts from 1
 *   last:  true if this is the last time statuscb will be called
 *   delay: delay before this try
 *   err:   any captured errors thrown from your function
 *
 * Notes: 
 * You need to handle and log simpledb errors yourself inside your own
 * function fn.  Generally you don't want to log "Service
 * Unavailable" messages are these expected, as that's the whole
 * reason for the exponential backoff! Use the statuscb callback for debugging.
 */
exports.expbackoff = function(fn,statuscb,maxtry,expbase,delaymin,delayscale,random) {
  if( null == fn ) { throw "retry function is null" }
  statuscb   = null == statuscb   ? function(){} : statuscb
  maxtry     = null == maxtry     ? 4            : maxtry
  expbase    = null == expbase    ? 4            : expbase
  delaymin   = null == delaymin   ? 0            : delaymin
  delayscale = null == delayscale ? 100          : delayscale
  random     = null == random     ? true         : random

  function retry(tryI,delay) {
    try {
      fn(stop,tryI,delay)
    }
    catch( err ) {
      stop(false,err)
    }

    function stop(done,err) {
      err = err || null
      var last = done || maxtry<=tryI
      statuscb(done,tryI,last,delay,err)

      if( !last ) {
        var nextdelay = delaymin + (delayscale * (random?Math.random():1) * Math.pow(expbase,tryI))

        setTimeout(function(){
          retry(tryI+1,nextdelay)
        }, nextdelay)
      }
    }
  }

  retry(1,0)
}



function arrayify(arrQ) {
  return Array.isArray(arrQ) ? arrQ : [arrQ]
}


exports.SimpleDB = function(opts) {
  var self = this;

  if( !opts ) throw MARK+'no opts'

  if(!(  self.keyid  = opts.keyid  )) throw MARK+'no keyid'
  if(!(  self.secret = opts.secret  )) throw MARK+'no secret'

  opts.secure     = null == opts.secure     ? false : opts.secure

  // true by default - helps beginners
  opts.consistent = null == opts.consistent ? true  : opts.consistent

  // test mode
  opts.test = null == opts.test ? false  : opts.test
  
  self.client = aws.createSimpleDBClient(opts.keyid, opts.secret, 
                                         // TODO make opt
                                         {secure:false})

  self.handle = function(op,q,start,tryI,res,stop,callback){
    eyes.inspect(res)

    var time = new Date().getTime()
    var err  = null
    var meta = {operation:op,query:q,result:res,time:time,duration:time-start,trycount:tryI}

    if( res.Errors ) {
      var error = arrayify(res.Errors.Error)[0]
      err = {Code:error.Code,Message:error.Message}
      meta.RequestId = res.RequestId
    }
    else {
      meta.RequestId = res.ResponseMetadata.RequestId
      meta.BoxUsage  = res.ResponseMetadata.BoxUsage
    }

    //util.debug('HANDLE:err='+JSON.stringify(err)+',meta='+JSON.stringify(meta))

    if( !err ) {
      stop(true)
      callback(err,res,meta)
    }
    else {
      stop(false)
    }
  }


  function makecall(act,q,handler) {
    if( !opts.test ) {
      var start = new Date().getTime()

      exports.expbackoff(
        function(stop,tryI,delay) {
          delete q.Signature
          //util.debug('CLIENTCALL:q='+JSON.stringify(q))
          self.client.call(act,q,function(res){
            self.handle(act,q,start,tryI,res,stop,handler)
          })
        },

        // TODO come from opts
        function(done,tryI,last,delay,err){
          util.debug('STATUS:'+[done,tryI,last,delay,''+err].join(':'))
        }
        //,2
      )
    }
  }


  function putattrs(q,attrs,prefix) {
    var aI = 1
    for( an in attrs ) {
      if( '$' != an.charAt(0) ) {
        var replace = !Array.isArray(attrs[an])
        var av = arrayify(attrs[an])
        av.forEach(function(val){
          q[prefix+'Attribute.'+aI+'.Name']    = an
          q[prefix+'Attribute.'+aI+'.Value']   = ''+val
          q[prefix+'Attribute.'+aI+'.Replace'] = replace
          aI++
        })
      }
    }
  }


  function getattrs(out,attrs,asarrays) {
    attrs.forEach(function(attr){
      var n = out[attr.Name]

      if( asarrays ) {
        (out[attr.Name] = n?n:[]).push(attrValue)
      }
      else {
        out[attr.Name] = (n?n+',':'') + attr.Value
      }
    })
  }

  
  function empty(name,value,callback) {
    var fail = false
    try {
      if( null == value ) {
        throw name+' is null'
      }
      if( 'string' != typeof(value) ) {
        throw name+' is not a string'
      } 
      if( '' == ''+value ) {
        throw name+' is empty'
      }
    }
    catch( errstr ) {
      if( callback ) {
        fail = true
        callback({Code:'$Library',Message:errstr})
      }
      else {
        throw errstr
      }
    }
    return fail
  }

  // callback (req), domain (opt), itemname (opt)
  function badargs() {
    var fail = false
    var callback = null

    var arglen = arguments.length

    callback = arguments[0]
    if( null == callback || 'function' != typeof(callback) ) {
      throw 'no callback function'
    }

    try {
      if( 2 <= arglen ) {
        empty('domain',arguments[1])
      }

      if( 3 <= arglen ) {
        empty('itemname',arguments[2])
      }
    }
    catch( errstr ) {
      fail = true
      callback({Code:'$Library',Message:errstr})
    }

    return fail
  }


  self.createDomain = function(name,callback){
    if( badargs(callback,name ))return

    var act = 'CreateDomain'
    var q   = {DomainName:name}

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  self.domainMetadata = function(name,callback){
    if( badargs(callback,name ))return

    var act = 'DomainMetadata'
    var q   = {DomainName:name}

    makecall(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        out = {}
        for( p in res.DomainMetadataResult ) {
          out[p] = parseInt(res.DomainMetadataResult[p],10)
        }
      }
      callback(err,out,meta)
    })
  }


  self.listDomains = function(callback){
    if( badargs(callback ))return

    var act = 'ListDomains'
    var q   = {}

    // TODO handle NextToken
    makecall(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        out = arrayify(res.ListDomainsResult.DomainName)
      }
      callback(err,out,meta)
    })
  }


  self.deleteDomain = function(name,callback){
    if( badargs(callback,name ))return

    var act = 'DeleteDomain'
    var q   = {DomainName:name}

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  self.putItem = function(domain,itemname,attrs,callback){
    if( badargs(callback,domain,itemname,attrs ))return

    var act = 'PutAttributes'
    var q   = {DomainName:domain,ItemName:itemname}
    putattrs(q,attrs,'')

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }

  self.batchPutItem = function(domain,items,callback){
    if( badargs(callback,domain ))return

    var act = 'BatchPutAttributes'
    var q   = {DomainName:domain}

    for( var itemI = 1; itemI <= items.length; itemI++ ) {
      var attrs = items[itemI-1]
      q['Item.'+itemI+'.ItemName'] = attrs.$ItemName
      putattrs(q,attrs,'Item.'+itemI+'.')
    }

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  // optional: asarrays
  self.getItem = function(domain,itemname,asarrays,callback){
    if( 'function' == typeof(asarrays) ) {
      callback = asarrays
      asarrays = false
    }
    if( badargs(callback,domain,itemname ))return

    var act = 'GetAttributes'
    var q   = {DomainName:domain,ItemName:itemname,ConsistentRead:''+opts.consistent}

    makecall(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        out = {$ItemName:itemname}
        getattrs(out,arrayify(res.GetAttributesResult.Attribute),asarrays)
      }
      callback(err,out,meta)
    })
  }


  // optional: attrs
  self.deleteItem = function(domain,itemname,attrs,callback){
    if( 'function' == typeof(attrs) ) {
      callback = attrs
      attrs = []
    }
    if( badargs(callback,domain,itemname ))return


    var act = 'DeleteAttributes'
    var q   = {DomainName:domain,ItemName:itemname}

    for( var aI = 1; aI <= attrs.length; aI++ ) {
      q['Attribute.'+aI+'.Name'] = attrs[aI-1]
    }

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  self.select = function(query,asarrays,callback) {
    if( 'function' == typeof(asarrays) ) {
      callback = asarrays
      asarrays = false
    }
    if( badargs(callback ))return
    if( empty('query',query,callback ))return


    var act = 'Select'
    var q   = {SelectExpression:query,ConsistentRead:''+opts.consistent}

    makecall(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        out = []
        var items = arrayify(res.SelectResult.Item)
        items.forEach(function(item){
          var outitem = {$ItemName:item.Name}
          getattrs(outitem,arrayify(item.Attribute),asarrays)
          out.push(outitem)
        })
      }
      callback(err,out,meta)
    })
  }


  self.request = function(act,query,callback) {
    if( empty('action',act,callback ))return
    var q = query
    makecall(act,q,callback)
  }


  

  return self
}

