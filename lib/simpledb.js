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
        //util.debug('STATUS:'+[done,tryI,last,delay,''+err].join(':'))
      }
      //,2
    )

  }


  function putattrs(q,attrs,prefix) {
    var aI = 1
    for( an in attrs ) {
      var replace = !Array.isArray(attrs[an])
      var av = arrayify(attrs[an])
      av.forEach(function(val){
        q['Attribute.'+aI+'.Name']    = an
        q['Attribute.'+aI+'.Value']   = ''+val
        q['Attribute.'+aI+'.Replace'] = replace
        aI++
      })
    }
  }


  function getattrs(out,res,asarrays) {
    var attrs = arrayify(res.GetAttributesResult.Attribute)
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


  self.createDomain = function(name,callback){
    var act = 'CreateDomain'
    var q   = {DomainName:name}

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  self.describeDomain = function(name,callback){
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


  self.put = function(domain,item,attrs,callback){
    var act = 'PutAttributes'
    var q   = {DomainName:domain,ItemName:item}
    putattrs(q,attrs,'')

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  // optional: asarrays
  self.get = function(domain,item,asarrays,callback){
    if( 'function' == typeof(asarrays) ) {
      callback = asarrays
      asarrays = false
    }

    var act = 'GetAttributes'
    var q   = {DomainName:domain,ItemName:item}

    makecall(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        out = {}
        getattrs(out,res,asarrays)
      }
      callback(err,out,meta)
    })
  }


  // optional: attrs
  self.remove = function(domain,item,attrs,callback){
    if( 'function' == typeof(attrs) ) {
      callback = attrs
      attrs = []
    }

    var act = 'DeleteAttributes'
    var q   = {DomainName:domain,ItemName:item}

    for( var aI = 1; aI <= attrs.length; aI++ ) {
      q['Attribute.'+aI+'.Name'] = attrs[aI-1]
    }

    makecall(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }

  return self
}

