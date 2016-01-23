/* Copyright (c) 2011 Richard Rodger */

var util = require('util')
var aws = require('aws-lib')


var MARK = 'simpledb: '



/* Exponential back-off for Amazon requests.
 * Algorithm as per pseudo-code in SimpleDB Dev Guide 2009-04-15, page 56
 * fn:          your function, that calls simpledb
 * statuscb:    a callback function that get status notifications (optional)
 * maxtry:      the maximum number of request attempts, default=4
 * expbase:     exponent base, default=4
 * delaymin:    minimum delay in milliseconds, default=0
 * delayscale:  millisecond multiplier for the exponential value
 * randomdelay: random multiplier to the delay, default=true
 *
 * Callbacks:
 * fn(stop,tryI,last,delay)
 *   stop:  callback to halt retries
 *     done: true if done, so stop
 *     err:  err for statuscb, if any
 *   tryI:  try index, starts from 1
 *   last:  true if this is the last try
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
exports.expbackoff = function(fn,statuscb,maxtry,expbase,delaymin,delayscale,randomdelay) {
  if( null == fn ) { throw MARK+"retry function is null" }
  statuscb    = null == statuscb   ? function(){} : statuscb
  maxtry      = null == maxtry     ? 4            : maxtry
  expbase     = null == expbase    ? 4            : expbase
  delaymin    = null == delaymin   ? 0            : delaymin
  delayscale  = null == delayscale ? 100          : delayscale
  randomdelay = null == randomdelay ? true        : randomdelay

  function retry(tryI,last,delay) {
    try {
      fn(stop,tryI,last,delay)
    }
    catch( err ) {
      stop(false,err)
    }

    function stop(done,err) {
      err = err || null
      var last = done || maxtry<=tryI
      statuscb(done,tryI,last,delay,err)

      if( !last ) {
        var nextdelay = delaymin + (delayscale * (randomdelay?Math.random():1) * Math.pow(expbase,tryI))

        setTimeout(function(){
          var nextTryI = tryI+1
          var nextLast = maxtry <= nextTryI
          retry(nextTryI,nextLast,nextdelay)
        }, nextdelay)
      }
    }
  }

  retry(1,false,0)
}



function arrayify(arrQ) {
  return !!arrQ ? Array.isArray(arrQ) ? arrQ : [arrQ] : []
}


exports.SimpleDB = function(opts,logger) {
  var self = this;

  if( !opts ) throw MARK+'no opts'

  if(!(  self.keyid  = opts.keyid  )) throw MARK+'no keyid'
  if(!(  self.secret = opts.secret  )) throw MARK+'no secret'

  opts.secure     = null == opts.secure     ? false : opts.secure

  // true by default - helps beginners
  opts.consistent = null == opts.consistent ? true  : opts.consistent

  // test mode - when true no simpledb calls are actually made
  opts.test = null == opts.test ? false  : opts.test

  // expbackoff
  var ebo = ['maxtry','expbase','delaymin','delayscale','randomdelay']
  ebo.forEach(function(opt){
    opts[opt] = null == opts[opt] ? null : opts[opt]
  })


  var awsopts = {}

  // false by default, due to node 0.3.x ssl issues
  awsopts.secure = null == opts.secure ? false : opts.secure

  awsopts.host    = null == opts.host    ? 'sdb.amazonaws.com' : opts.host
  awsopts.path    = null == opts.path    ? '/'                 : opts.path
  awsopts.version = null == opts.version ? '2009-04-15'        : opts.version

  // TODO - get aws-lib to support port
  awsopts.port    = null == opts.port    ? 80                  : opts.port
  awsopts.nolimit = null == opts.nolimit ? false               : opts.nolimit
  awsopts.maxdomains= 100 // this is set by the AWS service:
  awsopts.maxlimit= 2500 // this is set by the AWS service: http://docs.aws.amazon.com/AmazonSimpleDB/latest/DeveloperGuide/SDBLimits.html
  // container to aggregate results of the select queries over maxlimit
  var results = []

  log('create',opts,awsopts)

  self.client = aws.createSimpleDBClient(opts.keyid, opts.secret, awsopts)

  self.handle = function(start,act,q,tryI,last,res,stop,callback){
    log('handle',start,act,q,tryI,last,res)

    var time = new Date().getTime()
    var err  = null
    var meta = {action:act,query:q,result:res,time:time,duration:time-start,trycount:tryI}
    var retry = false

    if (!res){
       	if (last) {
     	  stop(true)
     	  callback("no response");
    	} else {
    	  stop(false);
    	}
    	return;
    }

    if( res && res.Errors ) {
      var error = arrayify(res.Errors.Error)[0]
      err = {Code:error.Code,Message:error.Message}
      meta.RequestId = res.RequestId

      // retry only server errors, as per SimpleDB dev guide
      retry = !!({
        'InternalError':true,
        'ServiceUnavailable':true
      }[err.Code])
    }
    else {
      if (res){
        meta.RequestId = res.ResponseMetadata.RequestId
        meta.BoxUsage  = res.ResponseMetadata.BoxUsage
      }
    }

    if( res && !err ) {
      // variables
      var maxcount = false;
      var nextToken = null;
      var count = 0;
      // save new results
      if( res.SelectResult ){
        results = results.concat( res.SelectResult.Item );
        nextToken = res.SelectResult.NextToken;
        count = ( res.SelectResult.Item ) ? res.SelectResult.Item.length : 0;
      } else if( res.ListDomainsResult ){
        results = results.concat( res.ListDomainsResult.DomainName );
        nextToken = res.ListDomainsResult.NextToken;
        count = ( res.ListDomainsResult.DomainName ) ? res.ListDomainsResult.DomainName.length : 0;
      }
      // check if we've achieved the max number of results
      try {
        maxcount = ( res.SelectResult ) ? ( count == awsopts.maxlimit ) : ( count == awsopts.maxdomains )
      } catch( e ){
        // nothing to do...
      }
      // optionally make subsequent requests for queries over the max limit
      if( awsopts.nolimit && maxcount && nextToken){
        // get the next batch of results
        q.NextToken = nextToken
        makereq(act,q,callback)
      } else {
        stop(true)
        // replacing with aggregated results only if nolimit is set
        if( awsopts.nolimit && res.SelectResult ) res.SelectResult.Item = results
        if( awsopts.nolimit && res.ListDomainsResult ) res.ListDomainsResult.DomainName = results
        callback(err,res,meta)
      }
    }
    else {
      log('error',start,act,q,tryI,last,retry,err,res,meta)
      stop(!retry,err)
      if( !retry || last ) {
        callback(err,null,meta)
      }
    }
  }


  function log(type) {
    if( logger ) {
      var args = Array.prototype.slice.call(arguments,1)
      args.unshift(type)
      args.unshift(new Date())
      logger.apply(self,args)
    }
  }


  function makereq(act,q,handler) {
    if( !opts.test ) {
      var start = new Date().getTime()
      log('request',start,act,q)

      exports.expbackoff(
        function(stop,tryI,last,delay) {

          // remove previous Signature from previous attempts
          delete q.Signature

          self.client.call(act,q,function(err, res){
            self.handle(start,act,q,tryI,last,res,stop,handler)
          })
        },

        function(done,tryI,last,delay,err){
          log('status',done,tryI,last,delay,err)
          opts.statuscb && opts.statuscb(done,tryI,last,delay,err)
        },

        opts.maxtry,opts.expbase,opts.delaymin,opts.delayscale,opts.randomdelay
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
          q[prefix+'Attribute.'+aI+'.Replace'] = ''+replace
          aI++
        })
      }
    }
  }


  function getattrs(out,attrs,asarrays) {
    attrs.forEach(function(attr){
      var n = out[attr.Name]

      if( asarrays ) {
        (out[attr.Name] = n?n:[]).push(attr.Value)
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
        throw MARK+name+' is null'
      }
      if( 'string' != typeof(value) ) {
        throw MARK+name+' is not a string'
      }
      if( '' == ''+value ) {
        throw MARK+name+' is empty'
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
      throw MARK+'no callback function'
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


  function getcallback(override,callback){
    return 'function' == typeof(override) ? override : callback
  }

  function getoverride(override){
    return 'object' == typeof(override) ? override : {}
  }

  function applyoverride(q,over) {
    if( 'object' == typeof(over) ) {
      for( p in over ) {
        if( '$' != p.charAt(0) ) {
          q[p] = over[p]
        }
      }
    }
  }

  self.createDomain = function(name,override,callback){
    callback = getcallback(override,callback)
    if( badargs(callback,name ))return

    var act = 'CreateDomain'
    var q   = {DomainName:name}

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  self.domainMetadata = function(name, override, callback ){
    callback = getcallback(override,callback)
    if( badargs(callback,name ))return

    var act = 'DomainMetadata'
    var q   = {DomainName:name}

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
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


  self.listDomains = function(override,callback){
    callback = getcallback(override,callback)
    if( badargs(callback ))return

    var act = 'ListDomains'
    var q   = {}

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        out = arrayify(res.ListDomainsResult.DomainName)
      }
      callback(err,out,meta)
    })
  }


  self.deleteDomain = function(name, override, callback ){
    callback = getcallback(override,callback)
    if( badargs(callback,name ))return

    var act = 'DeleteDomain'
    var q   = {DomainName:name}

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  self.putItem = function(domain,itemname,attrs, override, callback ){
    callback = getcallback(override,callback)
    if( badargs(callback,domain,itemname,attrs ))return

    var act = 'PutAttributes'
    var q   = {DomainName:domain,ItemName:itemname}
    putattrs(q,attrs,'')

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }

  self.batchPutItem = function(domain,items, override, callback ){
    callback = getcallback(override,callback)
    if( badargs(callback,domain ))return

    var act = 'BatchPutAttributes'
    var q   = {DomainName:domain}

    for( var itemI = 1; itemI <= items.length; itemI++ ) {
      var attrs = items[itemI-1]
      q['Item.'+itemI+'.ItemName'] = attrs.$ItemName
      putattrs(q,attrs,'Item.'+itemI+'.')
    }

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }

  self.batchDeleteItem = function(domain, items, override, callback) {
	  callback = getcallback(override,callback)
	  if( badargs(callback,domain ))return

	  var act = 'BatchDeleteAttributes'
	    var q   = {DomainName:domain}

	    for( var itemI = 1; itemI <= items.length; itemI++ ) {
	      var attrs = items[itemI-1]
	      q['Item.'+itemI+'.ItemName'] = attrs.$ItemName
	      putattrs(q,attrs,'Item.'+itemI+'.')
	    }

	    applyoverride(q,override)
	    makereq(act,q,function(err,res,meta){
	      var out = err ? null : {}
	      callback(err,out,meta)
	    })

  }


  // override: {$AsArrays:'true|false(def)'}
  self.getItem = function( domain, itemname, override, callback ){
    callback = getcallback(override,callback)
    if( badargs(callback,domain,itemname ))return

    var asarrays = getoverride(override).$AsArrays
    var act = 'GetAttributes'
    var q   = {DomainName:domain,ItemName:itemname,ConsistentRead:''+opts.consistent}

    applyoverride(q,override)

    // res is null if not found
    makereq(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        attrs = arrayify(res.GetAttributesResult.Attribute)
        if( 0 < attrs.length ) {
          out = {$ItemName:itemname}
          getattrs(out,attrs,asarrays)
        }
      }
      callback(err,out,meta)
    })
  }


  // optional: attrs
  self.deleteItem = function( domain, itemname, attrs, override, callback ){
    callback = getcallback(override,callback)
    if( 'function' == typeof(attrs) ) {
      callback = attrs
      attrs = []
    }
    if( badargs(callback,domain,itemname ))return


    var act = 'DeleteAttributes'
    var q   = {DomainName:domain,ItemName:itemname}

    if (Array.isArray(attrs)) {
      for( var aI = 1; aI <= attrs.length; aI++ ) {
        q['Attribute.'+aI+'.Name'] = attrs[aI-1]
      }
    }
    else {
      putattrs(q,attrs,'');
    }

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
      var out = err ? null : {}
      callback(err,out,meta)
    })
  }


  self.select = function(query, args, override, callback ) {
    if( !Array.isArray(args) ) {
      callback = override
      override = args
      args = []
    }
    results = []
    callback = getcallback(override,callback)
    if( badargs(callback ))return
    if( empty('query',query,callback ))return

    args.forEach(function(arg){
      arg = arg.replace(/'/g,"''")
      query = query.replace(/\?/,arg)
    })
    // automatically add the limit if nolimit option is selected
    if( awsopts.nolimit && query.indexOf(" limit ") == -1){
      query += " limit "+ awsopts.maxlimit;
    }
    var asarrays = getoverride(override).$AsArrays
    var act = 'Select'
    var q   = {SelectExpression:query,ConsistentRead:''+opts.consistent}

    applyoverride(q,override)
    makereq(act,q,function(err,res,meta){
      var out = null
      if( !err ) {
        out = []
        var items = arrayify(res.SelectResult.Item)
        items.forEach(function(item){
          // exit now if an empty array
          if(typeof item == "undefined") return
          var outitem = {$ItemName:item.Name}
          getattrs(outitem,arrayify(item.Attribute),asarrays)
          out.push(outitem)
        })
      }
      callback(err,out,meta)
    })
  }


  self.request = function(act,query, override, callback ) {
    callback = getcallback(override,callback)
    if( empty('action',act,callback ))return
    var q = query

    applyoverride(q,override)
    makereq(act,q,callback)
  }


  return self
}


exports.debuglogger = function(date,type) {
  strs = [MARK,date.toISOString(),type]
  for( var aI = 2; aI < arguments.length; aI++ ) {
    var a = arguments[aI]
    strs.push( 'object' == typeof(a) ? JSON.stringify(a) : ''+a )
  }
  util.debug(strs.join(' '))
}
