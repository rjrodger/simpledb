/* Copyright (c) 2011-2013 Richard Rodger, BSD License */


var util = require('util')
var assert = require('assert')

var eyes = require('eyes')
var nid  = require('nid')


var simpledb = require('../lib/simpledb.js')

var keys = require('./keys.mine.js')

var awshost = 'sdb.amazonaws.com'


module.exports = {
  expbackoff: function() {

    var action_calls = []
    function action(stop,tryI,last,delay) {
      action_calls.push(tryI+':'+last+':'+delay)
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

    // NOTE: assertions errors are appended to expectation arrays by statuscb above

    var testI = 0
    var tests = [

      // happy path
      function() {
        expect( [ '1:false:0', '2:false:20', '3:false:40' ],
                [ 'false:1:false:0:null', 'false:2:false:20:null', 'true:3:true:40:null' ] )
        simpledb.expbackoff(action,status,4,2,0,10,false)
      },

      // maxtry ends it
      function() {
        expect( [ '1:false:0', '2:true:20' ],
                [ 'false:1:false:0:null', 'false:2:true:20:null' ] )
        simpledb.expbackoff(action,status,2,2,0,10,false)
      },

      // exponent base
      function() {
        expect( [ '1:false:0', '2:false:40', '3:false:160' ],
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

  batchDelete: function() {
	  sdb = new simpledb.SimpleDB({keyid:keys.id, secret:keys.secret}, simpledb.debuglogger);

	  sdb.createDomain('batchDeleteTest', function(err,res,meta) {
		  assert.isNull(err);
		  sdb.batchPutItem('batchDeleteTest', [
		                     { $ItemName:'i1', batch:'yes', field:'one'},
		                     { $ItemName:'i2', batch:'yes', field:'two'},
		                     { $ItemName:'i3', batch:'yes', attr:'three'},
		                     { $ItemName:'i4', batch:'yes', xjk:'ui'}
		                   ], function(err, res, meta) {
			  assert.isNull(err);
			  sdb.batchDeleteItem('batchDeleteTest',
					  [{$ItemName:'i2'}, {$ItemName:'i3'}, {$ItemName:'i4', batch:'yes'}],
					  function(err, res, meta) {
				  assert.isNull(err);
				  sdb.select('select * from batchDeleteTest', function(err, res, meta) {
					  assert.isNull(err);
					  assert.ok(res.length==2, 'should only be 2 items');
					  assert.equal(JSON.stringify(res), JSON.stringify(
					  [{"$ItemName":"i1","batch":"yes","field":"one"},{"$ItemName":"i4","xjk":"ui"}]));

					  sdb.deleteDomain('batchDeleteTest', function(err, res, meta) {
						  assert.isNull(err);
					  });
				  });
			  });
		  });
	  });


  },

  simpledb: function() {
    var sdb = null

    try { sdb = new simpledb.SimpleDB() } catch(e) { assert.equal('simpledb: no opts',e) }
    assert.isNull(sdb)

    try { sdb = new simpledb.SimpleDB({}) } catch(e) { assert.equal('simpledb: no keyid',e) }
    assert.isNull(sdb)

    try { sdb = new simpledb.SimpleDB({keyid:'foo'}) } catch(e) { assert.equal('simpledb: no secret',e) }
    assert.isNull(sdb)

    var noop = function(){}
    var noerr = function(err){
      assert.isNull(err)
    }

    sdb = new simpledb.SimpleDB({keyid:'foo',secret:'bar',test:true},simpledb.debuglogger)

    function nocallback(f){
      try { sdb[f](); assert.fail() } catch(e) { assert.equal('simpledb: no callback function',e) }
    }

    nocallback('listDomains')

    function nostring(i,f,name){
      var cberr = function(suffix) {
        return function(err){
          //eyes.inspect(err)
          assert.isNotNull(err)
          assert.equal('$Library',err.Code)
          assert.equal('simpledb: '+name+suffix,err.Message)
        }
      }
      var calls = [[null,' is null'],['',' is empty'],[{},' is not a string']]
      calls.forEach(function(spec){
        var av   = spec[0]
        var errf = cberr(spec[1])
        sdb[f](0==i?av:'foo',1==i?av:errf,errf,errf)
      })
    }

    nostring(0,'request','action')


    var df = ['createDomain','domainMetadata','deleteDomain','batchPutItem','select']
    df.forEach(function(f){
      util.debug(f)
      nocallback(f)
      nostring(0,f,'select'==f?'query':'domain')
      if( 'batchPutItem'!=f ) { sdb[f]('foo',noerr,noerr) }
    })

    var df = ['putItem','getItem','deleteItem']
    df.forEach(function(f){
      util.debug(f)
      nocallback(f)
      nostring(0,f,'domain')
      nostring(1,f,'itemname')
    })


    // overrides
    sdb = new simpledb.SimpleDB({keyid:'foo',secret:'bar'},simpledb.debuglogger)

    sdb.handle = function(op,q,start,tryI,last,res,stop,callback){ assert.ok(!q.ConsistentRead) }
    sdb.getItem('domain','itemname',function(){

      sdb.handle = function(op,q,start,tryI,last,res,stop,callback){ assert.equal('false',q.ConsistentRead) }
      sdb.getItem('domain','itemname',{ConsistentRead:'false'},function(){})
    })


    // errors
    sdb = new simpledb.SimpleDB({keyid:'foo',secret:'bar'},simpledb.debuglogger)
    sdb.getItem('domain','itemname',function(err,res,meta){
      eyes.inspect(err)
      eyes.inspect(meta)
      assert.isNotNull(err)
      assert.equal('InvalidClientTokenId',err.Code)
      assert.equal(1, meta.trycount) // do not retry client errors
    })


    // the real deal
    eyes.inspect(keys)
    sdb = new simpledb.SimpleDB({keyid:keys.id,secret:keys.secret,host:keys.host||awshost},simpledb.debuglogger)
    eyes.inspect(sdb)

    var orighandle = sdb.handle
    var againhandle = function(op,q,start,tryI,last,res,stop,callback){
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
      orighandle(op,q,start,tryI,last,res,stop,callback)
    }


    ;sdb.createDomain('simpledbtest',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)

    ;sdb.domainMetadata('simpledbtest',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)

      sdb.handle = againhandle

    ;sdb.listDomains(function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.ok( 2 <= meta.trycount )
      assert.ok( Array.isArray(res) )
      assert.ok( 1 <= res.length )
      assert.equal(2, meta.trycount) // retry server errors

      sdb.handle = orighandle

    ;sdb.putItem('simpledbtest','item1',
      {
        foo:1,
        bar:'BAR',
        woz:['one','two','three','four'],
        quote:"'n"
      },function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)

    ;sdb.getItem('simpledbtest','not-an-item',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.isNull(res)

    ;sdb.getItem('simpledbtest','item1',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.equal('item1',res.$ItemName)
      assert.equal(1,parseInt(res.foo,10))
      assert.equal('BAR',res.bar)
      assert.equal('four,one,three,two',res.woz)
      assert.equal("'n",res.quote)

    ;sdb.getItem('simpledbtest','item1',{$AsArrays:true},function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.equal('item1',res.$ItemName)
      assert.equal(1,parseInt(res.foo[0],10))
      assert.equal('BAR',res.bar[0])
      assert.equal('four',res.woz[0])
      assert.equal('one',res.woz[1])
      assert.equal('three',res.woz[2])
      assert.equal('two',res.woz[3])
      assert.equal(4,res.woz.length)
      assert.equal("'n",res.quote[0])

    ;sdb.request("GetAttributes",
      {
        DomainName:'simpledbtest',
        ItemName:'item1',
        ConsistentRead:'true'
      },
      function(err,res,meta){
        debugres(null, err,res,meta)
        assert.isNull(err)
        assert.equal( 7, res.GetAttributesResult.Attribute.length )


    ;sdb.select("not a select expression at all at all",function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNotNull(err)
      assert.equal( 'InvalidQueryExpression', err.Code )

    ;sdb.select("select * from simpledbtest where bar = 'BAR'",function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.ok( 1 == res.length )
      assert.equal('item1',res[0].$ItemName)
      assert.equal( 'BAR', res[0].bar )

    ;sdb.select("select * from simpledbtest where bar = '?'",['BAR'],function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.ok( 1 == res.length )
      assert.equal('item1',res[0].$ItemName)
      assert.equal( 'BAR', res[0].bar )

    ;sdb.select("select * from simpledbtest where bar = '?' and quote = '?'",['BAR',"'n"],function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.ok( 1 == res.length )
      assert.equal('item1',res[0].$ItemName)
      assert.equal( 'BAR', res[0].bar )

    ;sdb.batchPutItem('simpledbtest',
      [
        { $ItemName:'b1', batch:'yes', field:'one'},
        { $ItemName:'b2', batch:'yes', field:'two'}
      ],
      function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)

    ;sdb.select("select * from simpledbtest where batch = 'yes'",function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.ok( 2 == res.length )
      assert.equal('b1',res[0].$ItemName)
      assert.equal('one', res[0].field )
      assert.equal('b2',res[1].$ItemName)
      assert.equal('two', res[1].field )

    // delete individual attr by value but leave item in place
    ;sdb.deleteItem('simpledbtest','item1', {'woz':'one'},function(err,res,meta) {
      debugres(null, err,res,meta)


    ;sdb.getItem('simpledbtest','item1',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.equal('item1',res.$ItemName)
      assert.equal(1,parseInt(res.foo,10))
      assert.equal('BAR',res.bar)
      assert.equal('four,three,two',res.woz)
      assert.equal("'n",res.quote)


    // delete individual attr by values but leave item in place
    ;sdb.deleteItem('simpledbtest','item1', {'woz': ['two','three']},function(err,res,meta) {
      debugres(null, err,res,meta)

    ;sdb.getItem('simpledbtest','item1',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)
      assert.equal('item1',res.$ItemName)
      assert.equal(1,parseInt(res.foo,10))
      assert.equal('BAR',res.bar)
      assert.equal('four',res.woz)
      assert.equal("'n",res.quote)


    // delete individual attr by name but leave item in place
    ;sdb.deleteItem('simpledbtest','item1', ['foo', 'bar'],function(err,res,meta) {
      debugres(null, err,res,meta)
      assert.isNull(err)

    ;sdb.getItem('simpledbtest','item1',function(err,res,meta){
      debugres(null,err,res,meta)
      assert.isNull(err)
      assert.equal('item1',res.$ItemName)
      assert.isUndefined(res.foo)
      assert.isUndefined(res.bar)
      assert.equal('four',res.woz)
      assert.equal("'n",res.quote)


    ;sdb.deleteItem('simpledbtest','item1',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)


    ;sdb.deleteDomain('simpledbtest',function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNull(err)


      // test bad key
      sdb = new simpledb.SimpleDB({keyid:'foo',secret:'bar'})
      //eyes.inspect(sdb)

    ;sdb.listDomains(function(err,res,meta){
      debugres(null, err,res,meta)
      assert.isNotNull(err)


    }) // listDomains

    }) // deleteDomain

    }) // deleteItem
    }) // getItem
    }) // deleteItem
    }) // getItem
    }) // deleteItem
    }) // getItem
    }) // deleteItem

    }) // select
    }) // batchPutItem

    }) // select
    }) // select
    }) // select
    }) // select

    }) // request
    }) // getItem
    }) // getItem
    }) // getItem
    }) // putItem

    }) // listDomains
    }) // domainMetadata
    }) // createDomain
  },

  example: function() {
    var keys = require('./keys.mine.js')
    sdb = new simpledb.SimpleDB({keyid:keys.id,secret:keys.secret,host:keys.host||awshost},simpledb.debuglogger)

    sdb.createDomain( 'yourdomain', function( error ) {

      sdb.putItem('yourdomain', 'item1', {field1:'one', field2:'two'}, function( error ) {

        sdb.getItem('yourdomain', 'item1', function( error, result ) {
          console.log( 'field1 = '+result.field1 )
          console.log( 'field2 = '+result.field2 )
        })
      })
    })
  },

  putItemHappy: function() {
    var keys = require('./keys.mine.js')
    sdb = new simpledb.SimpleDB({keyid:keys.id,secret:keys.secret,host:keys.host||awshost})//,simpledb.debuglogger)

    var itemid = nid()

    sdb.createDomain( 'yourdomain', function( error ) {

      sdb.putItem('yourdomain', 'put-'+itemid, {field1:'one'}, function( error ) {
        sdb.getItem('yourdomain', 'put-'+itemid, function( error, result ) {
          //console.dir(result)
          //console.log( 'field1 = '+result.field1 )
          assert.equal(result.field1, 'one')

          sdb.putItem('yourdomain', 'put-'+itemid, {field1:'ONE'}, function( error ) {
            sdb.getItem('yourdomain', 'put-'+itemid, function( error, result ) {
              //console.dir(result)
              //console.log( 'field1 = '+result.field1 )
              assert.equal(result.field1, 'ONE')
            })
          })
        })
      })
    })
  },

  alldomains: function(){
      var keys = require('./keys.mine.js')
      sdb = new simpledb.SimpleDB({keyid:keys.id,secret:keys.secret,host:keys.host||awshost,nolimit:true},simpledb.debuglogger)
      sdb.listDomains(function(err,res,meta){
        debugres(null, err,res,meta)
        assert.isNull(err)
        console.log("Domain count:", res.length);
        assert.isNotNull(res)
      })
  },

  nolimit: function() {
    var keys = require('./keys.mine.js')
    sdb = new simpledb.SimpleDB({keyid:keys.id,secret:keys.secret,host:keys.host||awshost,nolimit:true},simpledb.debuglogger)

    var count = remaining = 3000
    var batch = 25
    var domain = 'test_simpledb_nolimit'

    function createItems( cb ){

      var items = [];
      for(var i = 0; i < batch; i++){
          var itemid = nid();
          items.push({ $ItemName:'b'+itemid, batch:'yes', field:'one'});
      }
      // make bursts of 25 batchput requests so SimpleDB doesn't bail out
      sdb.batchPutItem('test_simpledb_nolimit', items, function( error ) {
        if( error ) console.log( 'error', error )
        remaining -= batch
        console.log( "remaining: "+ remaining)
        // repeat until the list is exhausted
        if( remaining ) {
          createItems( cb )
        } else {
          return cb()
        }
      })
    }

    sdb.createDomain( domain, function( error ) {
      if( error ) console.log( error );
      // first add a lot of items (>2500)
      console.log( 'adding 3000 items, this might take a while...')
      createItems(function(){
        console.log("Ready to perform nolimit tests: ")
        console.log("- Select the full domain with no limit")
        sdb.select('select * from '+ domain, function( error, result ) {
            // final result should match the original count
            assert.equal(result.length, count)

        console.log("- Select the full domain with a limit of 200")
        ;sdb.select('select * from '+ domain +' limit 200', function( error, result ) {
            // limit should not be overwritten if set
            assert.equal(result.length, 200)

        ;sdb.deleteDomain( domain, function( error ) {
          console.log("No limit tests completed successfully")

        })
        })
        })


      })

    })
  }

}


function debugres(note, err,res,meta) {
  if( note ) {
    util.debug(
      '\nnote: '+JSON.stringify(err)+
        '\nerr: '+JSON.stringify(err)+
        '\nres: '+JSON.stringify(res)+
        '\nmeta:'+JSON.stringify(meta)
    )
  }
}


if( 'run' == process.argv[2] ) {
  for( fname in module.exports ) {
    module.exports[fname]()
  }
}
