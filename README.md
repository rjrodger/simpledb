# simpledb

If you're using this library, feel free to contact me on twitter if you have any questions! :) [@rjrodger](http://twitter.com/rjrodger)

NOTE: this project follows the [Open-Open](https://github.com/rvagg/node-levelup/blob/master/CONTRIBUTING.md) policy - if you submit a pull request or an issue, you get commit rights, so feel free to merge yourself after asking for feedback from the other contribs.

IMPORTANT: YOUR CODE CONTRIBUTIONS (if any) ARE MADE UNDER THE MIT LICENSE. By submitting a pull request or issue you indicate agreement with this condition.

Please open an issue to indicate a release should be published to NPM, and we can discuss.



Current Version: 0.2.0

Tested on: node 0.12.4

A user-friendly **fault-tolerant** library for Amazon AWS SimpleDB access. The core
SimpleDB actions are mapped to functions:

    var simpledb = require('simpledb')
    var sdb      = new simpledb.SimpleDB({keyid:'YOUR_AWS_KEY_ID',secret:'YOUR_AWS_SECRET_KEY'})

    sdb.createDomain( 'yourdomain', function( error ) {

      sdb.putItem('yourdomain', 'item1', {attr1:'one', attr2:'two'}, function( error ) {

        sdb.getItem('yourdomain', 'item1', function( error, result ) {
          console.log( 'attr1 = '+result.attr1 )
          console.log( 'attr2 = '+result.attr2 )
        })
      })
    })

**Any given SimpleDB request has a non-trivial chance of failing. This
library implements the exponential back-off retry algorithm as
recommended in the SimpleDB developer guide.**

This library depends on the excellent aws-lib module: [aws-lib](https://github.com/mirkok/aws-lib)

Key Features:

   * simple API
   * fully configurable
   * detailed logging
   * all request attributes can be overridden
   * fully tested

Core Functions:

   * createDomain     (_"CreateDomain"_)
   * domainMetadata   (_"DomainMetadata"_)
   * listDomains      (_"ListDomains"_)
   * deleteDomain     (_"DeleteDomain"_)
   * putItem          (_"PutAttributes"_)
   * batchPutItem     (_"BatchPutAttributes"_)
   * batchDeleteItem  (_"BatchDeleteAttributes"_)
   * getItem          (_"GetAttributes"_)
   * deleteItem       (_"DeleteAttributes"_)
   * select           (_"Select"_)
   * request          (any action)

This is still an early version so there's probably some wierdness - use at your risk.
Secure connections are not supported on node 0.3.x.


## Installation

    npm install simpledb

And in your code:

    var simpledb = require('simpledb')

Or clone the git repository:
    git clone git://github.com/rjrodger/simpledb.git

The simpledb module depends on the [aws-lib](https://github.com/mirkok/aws-lib) module. npm will install this automatically.


## Usage

This module uses the node.js-style callback convention. All functions take
a callback function as their last argument. This callback function should accept three arguments:

    callback( error, result, meta )

Where error is an object `({Code:'...',Message:'...'})` describing any errors that occured. If the
function was successful then _error_ is _null_.

So, you check if _error_ is _null_ to see if you can continue working:

    sdb.listDomains( function( error, result, meta ) {
      if( error ) {
        console.log('listDomains failed: '+error.Message )
      }
      else {
        // do stuff with result, an array of domain names
      }
    })

The _result_ parameter contains the results of a successful action and
what the _result_ parameter is depends on the action. It could be a string, an array or
an object.

The _meta_ parameter contains a description of the request, including
the underlying details from Amazon. Take a look with:

    console.log( JSON.stringify(meta) )


## Conventions

Where possible, the SimpleDB naming style is preserved:
`CamelCaseBaby`. Names of functions and their parameters also mostly match SimpleDB.

The _simpledb.SimpleDB_ wrapper options (_maxtry_, _secure_, etc) are
not directly related to Amazon, and so have their own names.

It is sometimes necessary to embed meta-directives into the Amazon
_query_ or _result_ objects. These non-Amazon attributes always begin with
the _$_ character, but are in `CamelCase`. For example: `$AsArrays`.

This wrapper is based on the REST API. I looked at the SOAP API
but... yeah. No X.509 for you. Yet.


## API

For the API examples, assume the following lines of code at the top of your source code file:

    var simpledb = require('simpledb')

    var sdb = new simpledb.SimpleDB(
      {keyid:'YOUR_AWS_KEY_ID',secret:'YOUR_AWS_SECRET_KEY'},
      simpledb.debuglogger
    )

This gives you the standard wrapper, with a basic debugger that prints to STDOUT.

You should really also read the Amazon SimpleDB documentation so that you understand how SimpleDB works:
[Amazon SimpleDB Developer Guide](http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/)

As a get-out-of-jail, you can provide request attribute overrides. You
supply these in an optional _override_ argument just before the callback
argument. You can use an override on any of the SimpleDB action wrapper functions.

    sdb.getItem('domain','itemname', {ConsistentRead:'false'} ,function(err,res,meta){ ... })

In the above code, `{ConsistentRead:"false"}` is the optional override argument.


### simpledb.SimpleDB: `simpledb.SimpleDB( options, logger )`

  * _options_: (required) set of options; _keyid_ and _secret_ are required
  * _logger_: (optional) callback for log events

    var sdb = new simpledb.SimpleDB( options, logger )

Create a new SimpleDB wrapper. The _options_ argument sets general
options for the requests. The _logger_ argument receives logging events
so that you can debug and/or record SimpleDB interactions.

_options_: required

   * _keyid_: (required), your Amazon AWS Key ID
   * _secret_: (required), your Amazon Secret Key

For further options, see the section on options below


_logger_: optional

  See the section on logging below


### createDomain: `sdb.createDomain(domain,override,callback)`

  * _domain_: (required) the name of the domain
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Create a domain. A domain is like a SQL table, sort of.

    sdb.createDomain('<domain>',function(err,res,meta){
      if( !err ) {
        console.log('Mul-ti-pass!')
      }
    }

Where `<domain>` is the name of your domain.



### domainMetadata: `sdb.domainMetadata(domain,override,callback)`

  * _domain_: (required) the name of the domain
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Get some statistics about your domain, such as a count of items and how much storage it is using (you pay Amazon for this!).

    sdb.domainMetadata('<domain>',function(err,res,meta){
       console.log('Mmm, floor pie! '+JSON.stringify(res) )
    }

Where `<domain>` is the name of your domain.



### listDomains: `sdb.listDomains(override,callback)`

  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Returns a list of your domain names as an array of strings. Restricted
to the specified SimpleDB host (default=sdb.amazonaws.com). See the
_simpledb.SimpleDB_ options to change this.

    sdb.listDomains(function(err,res,meta){
       console.log('You hear that? That's market bacon hitting the pan: '+JSON.stringify(res) )
    }



### deleteDomain: `sdb.deleteDomain(domain,override,callback)`

  * _domain_: (required) the name of the domain
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Delete a domain. Cannot be undone!

    sdb.deleteDomain('<domain>',function(err,res,meta){
      if( !err ) {
        console.log('God made the world, but we made the field.')
      }
    }

Where `<domain>` is the name of your domain.


### putItem: `sdb.putItem(domain,itemname,attrs,override,callback)`

  * _domain_: (required) the name of the domain
  * _itemname_: (required) the unique name of the item in the domain
  * _attrs_: (required) the item attributes to store
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Store an item in SimpleDB.

    sdb.putItem('<domain>','<itemname>',
      {
        <attr>:'<value>',
        ...
      },
      function(err,res,meta){
        console.log("Memories, you're talking about memories: "+JSON.stringify(res))
      })

Where `<itemname>` is the unique name of your item, and
`<attr>:"<value>"` are the attribute-value pairs for your item. The value
must be either a string or an array of strings.

If you want to use conditional puts, you'll need to add some override values:

    sdb.putItem('<domain>','<itemname>',
      {
        <attr1>:'<value>',
        <attr2>:['<value1>','<value2>',...]
        ...
      },
      {
        'Expected.1.Name':'VersionNumber',
        'Expected.1.Value':'1'
      },
      function(err,res,meta){
        console.log("Nobody expects the spanish inquistion! "+JSON.stringify(res))
      })


### batchPutItem: `sdb.batchPutItem( domain, items, override, callback )`

  * _domain_: (required) the name of the domain
  * _items_: (required) the list of items to store
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Store multiple items in the same request. This is more efficient. The _items_
argument is an array of item objects. Each item object must have a
_$ItemName_ meta-attribute that specifies the name of the item.

    sdb.batchPutItem('<domain>',
      [
        { $ItemName:'<itemname1>', <attr>:'<value>', ...},
        { $ItemName:'<itemname2>', <attr>:'<value>', ...}
      ],function(err,res,meta){
        console.log("And what was your ownership share diluted down to?"+JSON.stringify(res))
      })

### batchDeleteItem: `sdb.batchDeleteItem( domain, items, override, callback )`

  * _domain_: (required) the name of the domain
  * _items_: (required) the list of items to delete
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Delete multiple items in one request. This is more efficient. The _items_
argument is an array of item objects. Each item object must have a
_$ItemName_ meta-attribute that specifies the name of the item.

    sdb.batchDeleteItem('<domain>',
      [
        { $ItemName:'<itemname1>', <attr>:'<value>', ...},
        { $ItemName:'<itemname2>', <attr>:'<value>', ...}
      ],function(err,res,meta){
        console.log("Done"+JSON.stringify(res))
      })



### getItem: `sdb.getItem( domain, itemname, override, callback )`

  * _domain_: (required) the name of the domain
  * _itemname_: (required) the unique name of the item in the domain
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Get an item from SimpleDB using the item's unique name. The values of
the item's attributes are returned as strings.  You can provide an
_$AsArrays_ meta-directive in the _override_ argument. When _true_, all
attribute values are returned as arrays. As
SimpleDb is schemaless, it is not possible to know in advance if an attribute
 is multi-valued. In the default case, `{$AsArrays:false}`,
multiple values are returned as string, with the value list
comma-separated. SimpleDB returns multiple values in alphabetical
order.

    sdb.getItem('<domain>','<itemname>',function( error , result, meta ){
      console.log("Those are good burgers, Walter: "+JSON.stringify(res))
    })

    sdb.getItem('<domain>','<itemname>',{$AsArrays:true},function( error, result, meta ){
      console.log("I've been watching television so much the shows are starting to run together: "+JSON.stringify(res))
    })

By default, _simpledb_ uses consistent reads. For improved
performance, if this is suitable for your application, you can set the _consistent_ option to _false_ when creating
_simpledb.SimpleDB_. Or you can set it on a case-by-case basis, using an override: `{ConsistentRead:"false"}`



### deleteItem: `sdb.deleteItem( domain, itemname, attrs, override, callback )`

  * _domain_: (required) the name of the domain
  * _itemname_: (required) the unique name of the item in the domain
  * _attrs_: (optional) the attributes to delete
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Delete an item from SimpleDB. The _attrs_ argument is optional, and can be:
  * an array of attribute names: all matching attributes will be deleted
  * an object whose properties are attribute names:
attributes of the item will be deleted if they have the same value as the object properties.
Values can be either a single string, or an array of string values, in which case all matching attributes are deleted.

If no attributes are specified, the item is completely
removed. If present, only the specified attributes are removed. If all
the attributes of an item are removed, then it will also be completely
deleted.

    sdb.deleteItem('<domain>','<itemname>',function( error, result, meta ){
      console.log("Well, Ted, like I said the last time: it won't happen again: "+JSON.stringify(res))
    })

    sdb.deleteItem('<domain>','<itemname>',[ '<attr>', ... ], function( error, result, meta ){
      console.log("I felt like destroying something beautiful. "+JSON.stringify(res))
    })

    sdb.deleteItem('<domain>','<itemname>',
      { '<attr1>': '<value1>', 'attr2': ['<value2>, ... ], ... },
      function( error, result, meta ){
        console.log("I don't know what to write about. "+JSON.stringify(res))
      }
    )


### select: `sdb.select( query, override, callback )`

  * _query_: (required) SimpleDB select expression
  * _override_: (optional) SimpleDB attributes to override function defaults
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Perform a SELECT-style query on a SimpleDB domain. The syntax is
almost-but-not-quite SQL. You should read the Amazon documentation:
[Using Select](http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/UsingSelect.html)

The results are returned as an array of items. Each item contains
an _$ItemName_ meta-attribute providing you with the name of the item.

If you need to handle _NextToken_ you'll need to do this manually with
the override argument. You can get the _NextToken_ from the _meta_ parameter to your callback.

    sdb.select("select * from <domain> where <attribute> = '<value>'",function( error, result, meta ){
      console.log("I'll get you, my pretty, and your little dog too! "+JSON.stringify(result)+" "+JSON.stringify(meta))
    })


### request: `sdb.request( action, attrs, callback )`

  * _action_: (required) SimpleDB action
  * _attrs_: (required) SimpleDB request attributes
  * _callback_: (required) callback function accepting parameters _callback(error, result, metadata)_

Make a direct request to SimpleDB. You're on your own! Again, read
[Amazon SimpleDB Developer Guide](http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/)
Unlike the other functions above, the _request_ function is not a SimpleDB action wrapper. Use it when the wrapper functions have painted themselves into a corner.

    sdb.request("<action>",
      {
        <attribute>:"<value>",
        ...
      },
      function( error, result, meta ){
        console.log("Gotta keep 'em separated: "+JSON.stringify(res))
      })

Where `<action>` is the SimpleDB action, such as _GetItem_, and `<attribute>:"<value>"` are the SimpleDB REST request attribute pairs.


### client: `sdb.client`

The `aws-lib` client object. Use this to send raw requests. Go hardcore.


### handle: `sdb.handle( start, action, query, tryIndex, last, response, stop, callback, )`

   * _start_: Date object, start time of request
   * _action_: string, name of SimpleDB action
   * _query_: full SimpleDB query
   * _tryIndex_: number of tries attempted, up to maxtry
   * _last_: true if this is the last request that will be made
   * _response_: result from SimpleDB
   * _stop_: stop(true|false), function to stop retries in case of errors
   * _callback_: action-specific callback, as provided by functions like getItem, putItem, etc.

Replace this with your own implementation to change the handling of
SimpleDB responses. Most useful is to modify the response in some way
and then call the original function. Also good for testing.

This example counts the number of requests made:

    var resultcount = 0

    var orighandle = sdb.handle
    sdb.handle = function(start,action,query,tryIndex,last,response,stop,callback){
      res.$ResultCount = resultcount++
      orighandle(start,action,query,tryIndex,last,response,stop,callback)
    }



## Options

The additional options that can be given to _simpledb.SimpleDB_ are:

   * _secure_: (optional, default=false), if true, use HTTPS
   * _consistent_: (optional, default=true), if true, ask for consistent reads
   * _test_: (optional, default=false), if true, don't actually send anything to SimpleDB
   * _host_: (optional, default=sdb.amazon.com), SimpleDB host
   * _path_: (optional, default=/), SimpleDB path
   * _version_: optional), default=2009-04-15, SimpleDB API version
   * _maxtry_: (optional, default=4), maximum number of retries when SimpleDB fails
   * _delaymin_: (optional, default=0), minimum delay in milliseconds
   * _delayscale_: (optional, default=100), delay multiplier, in milliseconds
   * _randomdelay_: (optional, default=true), apply a random delay multiplier between 0 and 1
   * _expbase_: (optional, default=4), exponent base, for the formula that calculates delay time when SimpleDB fails
   * _nolimit_: (optional, default=false), if true, it will return results over the max limit of 2500 with subsequent api requests


## Logging

You can provide a logger callback when you are creating the _simpledb.SimpleDB_
object to get notifications of request processing events. A simple logger that
prints to STDOUT is provided by _simpledb.debuglogger_:

    var sdb = new simpledb.SimpleDB( {...}, simpledb.debuglogger )

The logger callback accepts the following arguments:
    logger( type, date, ... )

   * _type_: string, one of _create_, _request_, _handle_, _error_, _status_
   * _date_: a Date object
   * ...: remaining arguments depend on type

For _type=create_, fired when the simpledb.SimpleDB object is created, the arguments are:

   * _opts_: options object
   * _awsopts_: aws-lib options

For _type=request_, fired just before a request is made to SimpleDB, the arguments are:

   * _start_: Date object, start time of request
   * _action_: string, name of SimpleDB action
   * _query_: full SimpleDB query

For _type=handle_, fired after each response from SimpleDB, the arguments are:

   * _start_: Date object, start time of request
   * _action_: string, name of SimpleDB action
   * _query_: full SimpleDB query
   * _tryIndex_: number of tries attempted, up to maxtry
   * _last_: true if this is the last request that will be made
   * _response_: result from SimpleDB

For _type=error_, fired after any response with an error, the arguments are:

   * _start_: Date object, start time of request
   * _action_: string, name of SimpleDB action
   * _query_: full SimpleDB query
   * _tryIndex_: number of tries attempted, up to maxtry
   * _last_: true if this is the last request that will be made
   * _retry_: true if a retry will be attempted
   * _err_: the error that occurred, an object like {Code:'...',Message:'...'}, where _Code_ is the Amazon error code
   * _res_: the result
   * _meta_: the request meta data

For _type=status_, fired after each retry, the arguments are:

   * _done_: true if request has finally succeeded
   * _tryIndex_: count of attempts
   * _last_: true if this was the last attempt
   * _delay_: delay in milliseconds until this attempt
   * _err_: any error that occurred


## Testing

The unit tests use [expresso](https://github.com/visionmedia/expresso)

    npm install expresso
    npm install eyes

To configure your keys, edit the test/keys.js file.
The tests are in test/simpledb.test.js


## Amazon AWS SimpleDB

Here's some more information on SimpleDB:

[Amazon AWS SimpleDB Developer Guide](http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/)


