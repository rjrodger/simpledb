/* Copyright (c) 2011 Richard Rodger */


var util = require('util')
var assert = require('assert')
var eyes = require('eyes')

var simpledb = require('../lib/simpledb.js')


module.exports = {
  expbackoff: function() {

    var action_calls = []
    function action(stop,tryI,delay) {
      action_calls.push(tryI+':'+delay)
      stop(2 < tryI)
    }

    var status_calls = []
    function status(done,tryI,last,delay,err){
      status_calls.push([done,tryI,last,delay,''+err].join(':'))

      if( last ) {
        assertlast()
      }
    }

    var action_calls_expect
    var status_calls_expect

    function assertlast() {
      eyes.inspect(action_calls)
      eyes.inspect(status_calls)

      var cb = [[action_calls,action_calls_expect],[status_calls,status_calls_expect]]
      cb.forEach(function(callbackarr){
        var calls = callbackarr[0]
        var calls_expect = callbackarr[1]
        if( Array.isArray(calls_expect) ) {
          assert.equal(JSON.stringify(calls_expect),JSON.stringify(calls))
        }
        else {
          assert.equal(calls_expect,calls.length)
        }
      })

      testI++
      tests[testI] && tests[testI]()
    }

    function expect(a,s){
      action_calls = []
      status_calls = []
      action_calls_expect = a
      status_calls_expect = s
    }

    var testI = 0
    var tests = [

      // happy path
      function() {
        expect( [ '1:0', '2:20', '3:40' ],
                [ 'false:1:false:0:null', 'false:2:false:20:null', 'true:3:true:40:null' ] )
        simpledb.expbackoff(action,status,4,2,0,10,false)
      },

      // maxtry ends it
      function() {
        expect( [ '1:0', '2:20' ],
                [ 'false:1:false:0:null', 'false:2:true:20:null' ] )
        simpledb.expbackoff(action,status,2,2,0,10,false)
      },

      // exponent base
      function() {
        expect( [ '1:0', '2:40', '3:160' ],
                [ 'false:1:false:0:null', 'false:2:false:40:null', 'true:3:true:160:null' ] )
        simpledb.expbackoff(action,status,4,4,0,10,false)
      },

      // randomz
      function() {
        expect( 3,3 )
        simpledb.expbackoff(action,status,4,2,0,10,true)
      },

      // defaultz
      function() {
        expect( 3,3 )
        simpledb.expbackoff(action,status)
      },
    ]

    tests[testI]()
  },

  simpledb: function() {
    var sdb = null

    try { sdb = new simpledb.SimpleDB() } catch(e) { assert.equal('simpledb: no opts',e) }
    assert.isNull(sdb)

    try { sdb = new simpledb.SimpleDB({}) } catch(e) { assert.equal('simpledb: no keyid',e) }
    assert.isNull(sdb)

    try { sdb = new simpledb.SimpleDB({keyid:'foo'}) } catch(e) { assert.equal('simpledb: no secret',e) }
    assert.isNull(sdb)


    sdb = new simpledb.SimpleDB({keyid:'foo',secret:'bar'})
    eyes.inspect(sdb)
   
    sdb.listDomains(function(err,res,meta){
      debugres(err,res,meta)
      assert.isNotNull(err)
    })


    var keys = require('./keys.js')
    sdb = new simpledb.SimpleDB({keyid:keys.id,secret:keys.secret})
    //eyes.inspect(sdb)

    var orighandle = sdb.handle
    var againhandle = function(op,q,start,tryI,res,stop,callback){
      if( 1 == tryI ) {
        res = {
          Errors:{
            Error:{
              Code:'ServiceUnavailable',
              Message:'Service AmazonSimpleDB is currently unavailable. Please try again later'
            },
          },
          RequestID:'81abaa80-7309-e39e-2644-b33b2c3acb57'
        }
      }
      orighandle(op,q,start,tryI,res,stop,callback)
    }


    ;sdb.createDomain('simpledbtest',function(err,res,meta){
      debugres(err,res,meta)
      assert.isNull(err)

    ;sdb.describeDomain('simpledbtest',function(err,res,meta){
      debugres(err,res,meta)
      assert.isNull(err)

      sdb.handle = againhandle
 
    ;sdb.listDomains(function(err,res,meta){
      debugres(err,res,meta)
      assert.isNull(err)
      assert.ok( 2 <= meta.trycount )
      assert.ok( Array.isArray(res) )
      assert.ok( 1 <= res.length )
      sdb.handle = orighandle
      
    ;sdb.put('simpledbtest','item1',
      {
        foo:1,
        bar:'BAR',
        woz:['one','two']
      },function(err,res,meta){
      debugres(err,res,meta)
      assert.isNull(err)

    ;sdb.get('simpledbtest','item1',function(err,res,meta){
      debugres(err,res,meta)
      assert.isNull(err)
      assert.equal(1,parseInt(res.foo,10))
      assert.equal('BAR',res.bar)
      assert.equal('one,two',res.woz)

    ;sdb.remove('simpledbtest','item1',function(err,res,meta){
      debugres(err,res,meta)
      assert.isNull(err)

    }) }) }) }) }) })
  }

}


function debugres(err,res,meta) {
  util.debug(
    '\nerr: '+JSON.stringify(err)+
    '\nres: '+JSON.stringify(res)+
    '\nmeta:'+JSON.stringify(meta)
  )
}


if( 'run' == process.argv[2] ) {
  for( fname in module.exports ) {
    module.exports[fname]()
  }
}