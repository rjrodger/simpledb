
!! NOT YET AVAILABLE VIA NPM !!

## PRE-RELEASE INSTALL

    git clone git://github.com/rjrodger/node-simpledb.git
    npm install node-simpledb/

    git clone git://github.com/mirkok/aws-lib.git
    npm install aws-lib/


## node-simpledb

A user-friendly library for Amazon AWS SimpleDB access. The core
SimpleDB actions are mapped to functions:

    var simpledb = require('node-simpledb')
    var sdb      = new simpledb.SimpleDB({keyid:'YOUR_AWS_KEY_ID',secret:'YOUR_AWS_SECRET_KEY'})

    sdb.createDomain( 'yourdomain', function( error ) {

      sdb.putItem('yourdomain', 'item1', {attr1:'one', attr2:'two'}, function( error ) {
      
        sdb.getItem('yourdomain', 'item1', function( error, result ) {
          console.log( 'attr1 = '+result.attr1 )
          console.log( 'attr2 = '+result.attr2 )
        })
      })
    })

Any given SimpleDB request has a non-trivial chance of failing. This
library implements the exponential back-off retry algorithm as
recommended in the SimpleDB developer guide

This library depends on the excellent aws-lib module: https://github.com/mirkok/aws-lib

Key Features:

   * simple API
   * fully configurable
   * detailed logging
   * all request attributes can be overridden
   * fully tested

This is version 0.0.1 so there's probably still some wierdness - use at your risk.
Secure connections are not supported on node 0.3.x.


## Installation

    npm install node-simpledb

And in your code:

    var simpledb = require('node-simpledb')

Or clone the git repository:
    git clone git://github.com/rjrodger/node-simpledb.git


## Usage

This module uses the node.js-style callback convention. All functions take
a callback function as their last argument. This callback function should accept three arguments:

    callback( error, result, meta )

Where error is an object ({Code:'...',Message:'...'}) describing any errors that occured. If the
function was successful then error is null. 

So, you check if error is null to see if you can continue working:

    sdb.listDomains( functions( error, result, meta ) {
      if( error ) {
        console.log('listDomains failed: '+error.Message )
      }
      else {
        // do stuff with result, an array of domain names
      }
    })

The _result_ parameter contains the results of a successful action and
what it is depends on the action. It could be a string, an array or
an object.

The _meta_ parameter contains a description of the request, including the underlying details from Amazon.

    console.log( JSON.stringify(meta) )


## Conventions

Where possible, the SimpleDB naming style is preserved:
CamelCaseBaby. Names of functions and their parameters also match SimpleDB
as much as possible.

The _simpledb.SimpleDB_ wrapper options (_maxtry_, _secure_, etc) are
not directly to Amazon, and so have their own names.

It is sometimes necessary to embed meta directives into the Amazon
query or result objects. These non-Amazon attributes always begin with
$ character, but are in CamelCase. For example: $AsArrays.

This wrapper is based on the REST API. I looked at the SOAP API
but... yeah. No X.509 for you. Yet.


## API

For the API examples, assume the following lines of code:

    var simpledb = require('node-simpledb')
    var sdb = new simpledb.SimpleDB(
      {keyid:'YOUR_AWS_KEY_ID',secret:'YOUR_AWS_SECRET_KEY'},
      simpledb.debuglogger
    )

This gives you the standard wrapper, with a basic debugger that prints to STDOUT.

You should really also read the Amazon SimpleDB documentation so that you understand how SimpleDB works.

As a get-out-of-jail, you can provide request attribute overrides. You
supply these in an optional override object just before the callback
argument. You can use can override on any of the SimpleDB action wrapper functions.

    sdb.getItem('domain','itemname', {ConsistentRead:'false'} ,function(err,res,meta){ ... })

In the above code, _{ConsistentRead:'false'}_ is the optional override argument.


### simpledb.SimpleDB

    var sdb = new simpledb.SimpleDB( options, logger )

Create a new SimpleDB wrapper. The options argument gives you control
over the requests. The logger argument receives logging events so
that you can debug and/or record SimpleDB interactions.

options: some required

   * keyid: required, your Amazon AWS Key ID
   * secret: required, your Amazon Secret Key
   * secure: optional, default=false, if true, use HTTPS
   * consistent: optional, default=true, if true, ask for consistent reads
   * test: optional, default=false, if true, don't actually send anything to SimpleDB
   * host: optional, default=sdb.amazon.com, SimpleDB host
   * path: optional, default=/, SimpleDB path
   * version, optional, default=2009-04-15, SimpleDB API version
   * maxtry: optional, default=4, maximum number of retries when SimpleDB fails
   * delaymin: optional, default=0, minimum delay in milliseconds
   * delayscale: optional, default=100, delay multiplier, in milliseconds
   * randomdelay: optional, default=true, apply a random delay multiplier between 0 and 1
   * expbase: optional, default=4, exponent base, for the formula that calculates delay time when SimpleDB fails

logger: optional

  See the section on logging below


### sdb.createDomain(domain,override,callback)

Create a domain. Like a SQL table, sort of.

    sdb.createDomain('<domain>',function(err,res,meta){
      if( !err ) {
        console.log('Mul-ti-pass!')
      }
    }

Where <domain> is the name of your domain.



### sdb.domainMetadata(domain,override,callback)

Get some statistics about your domain, such as a count of items and how much storage it is using (you pay for this!).

    sdb.domainMetadata('<domain>',function(err,res,meta){
       console.log('Mmm, floor pie! '+JSON.stringify(res) )
    }

Where <domain> is the name of your domain.



### sdb.listDomains(override,callback)

Returns a list of your domain names as an array of strings. Restricted
to the specificed SimpleDB host (default=sdb.amazonaws.com). See the
simpledbSimppleDB options to change this.

    sdb.listDomains(function(err,res,meta){
       console.log('You hear that? That's market bacon hitting the pan: '+JSON.stringify(res) )
    }



### sdb.deleteDomain(domain,override,callback)

Delete a domain. Cannot be undone!

    sdb.deleteDomain('<domain>',function(err,res,meta){
      if( !err ) {
        console.log('God made the world, but we made the field.')
      }
    }

Where <domain> is the name of your domain.


### sdb.putItem(domain,itemname,attributes,override,callback)

Store an item in SimpleDB.

    sdb.putItem('<domain>','<itemname>', 
      {
        <attr>:'<value>',
        ...
      },
      function(err,res,meta){
        console.log("Memories, you're talking about memories: "+JSON.stringify(res)) 
      })

Where <itemname> is the unique name of your item, and
<attr>:"<value>" are the attr-value pairs for your item. The value
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


### sdb.batchPutItem( domain, items, override, callback )

Store multiple items in the same request. More efficient. The _items_
argument is an array of item objects. Each item object must have a
$ItemName meta attribute that specifies the name of the item.

    sdb.batchPutItem('<domain>',
      [ 
        { $ItemName:'<itemname1>', <attr>:'<value>', ...}, 
        { $ItemName:'<itemname2>', <attr>:'<value>', ...}
      ],function(err,res,meta){
        console.log("And what was your ownership share diluted down to?"+JSON.stringify(res)) 
      })



### sdb.getItem( domain, itemname, override, callback )

Get an item from SimpleDB using the item's unique name. The values of
the item's attributes are returned as strings.  You can provide a
$AsArrays meta directive in the override argument. When true, all
attribute values are returned as arrays. The reason for this is that as
SimpleDb is schemaless, it is not possible to know in advance if an attribute
 is multi-valued. In the default case, ($AsArrays:false),
multiple values are returned as string, with the value list comma-separated.

    sdb.getItem('<domain>','<itemname>',function(err,res,meta){
      console.log("Those are good burgers, Walter: "+JSON.stringify(res)) 
    })

    sdb.getItem('<domain>','<itemname>',{$AsArrays:true},function(err,res,meta){
      console.log("I've been watching television so much the shows are starting to run together: "+JSON.stringify(res)) 
    })

By default, node-simpledb uses consistent reads. For improved
performance, if this is suitable for your application, you can set the _consistent_ option to _false_ when creating
_simpledb.SimpleDB_. Or you can set it on a case-by-case basis, using an override: {ConsistentRead:'false'}



### deleteItem( domain, itemname, attrs, override, callback )

Delete an item from SimpleDB. The _attrs_ argument is an optional
array of attribute names. If not present, the item is completely
removed. If present, only the specified attributes are removed. If all
the attributes of an item are removed, then it will also be completely
deleted.

    sdb.deleteItem('<domain>','<itemname>',function(err,res,meta){
      console.log("Well, Ted, like I said the last time: it won't happen again: "+JSON.stringify(res)) 
    })

    sdb.deleteItem('<domain>','<itemname>',[ '<attr>', ... ]function(err,res,meta){
      console.log("I felt like destroying something beautiful. "+JSON.stringify(res)) 
    })


### select( query, override, callback )

Perform a SELECT-style query on a SimpleDB domain. The syntax is
almost-but-not-quite SQL. You should read the Amazon documentation:
http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/UsingSelect.html

The results are returned as an array of items. Each item contains
$ItemName meta attribute providing you with the name of the item.

If you need to handle _NextToken_ you'll need to do this manually with
the override argument. You can get the _NextToken_ from the _meta_ parameter to your callback.

    sdb.select("select * from <domain> where <attribute> = '<value>'",function(err,res,meta){
      console.log("I'll get you, my pretty, and your little dog too! "+JSON.stringify(res)) 
    })


### sdb.request

Make a direct request to SimpleDB. You're on your own: http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/
This is not a SimpleDB action wrapper. Use it when the wrapper functions have painted themselves into a corner.

    sdb.request("<action>", 
      {
        <attribute>:"<value>",
        ...
      },
      function(err,res,meta){
        console.log("Gotta keep 'em separated: "+JSON.stringify(res)) 
      })

Where <action> is the SimpleDB action, such as _GetItem_, and <attribute>:"<value>" are the SimpleDB request attribute pairs.

### sdb.client

The aws-lib client object. Use this to send raw requests. Go hardcore.


### sdb.handle

Replace this with your own implementation to change the handling of
SimpleDB response. Most useful is to modify the response in some way
and then call this function. Also good for testing.

    var resultcount = 0    

    var orighandle = sdb.handle
    sdb.handle = function(start,action,query,tryIndex,response,stop,callback){
      res.$ResultCount = resultcount++
      orighandle(start,act,q,tryI,res,stop,callback)
    }

The parameters are:
   * start: Date object, start time of request
   * action: string, name of SimpleDB action
   * query: full SimpleDB query
   * tryIndex: number of tries attempted, up to maxtry 
   * response: result from SimpleDB
   * stop: stop(true|false), function to stop retries in case of errors
   * callback: action-specific callback, as provided by functions like getItem, putItem, etc.

## Logging

Provide a logger callback when you are creating the simpledb.SimpleDB
object to get notifications of request processing events. A simple logger that
prints to STDOUT is provided by simpledb.debuglogger:

    var sdb = new simpledb.SimpleDB( {...}, simpledb.debuglogger )

The logger callback accepts the following arguments:
    logger( type, date, ... )

   * _type_: string, one of _create_, _request_, _handle_, _error_, _status_
   * date: a Date object
   * ...: remaining arguments depend on type

For type=create, fired when the simpledb.SimpleDB object is created, the arguments are:

   * opts: options object
   * awsopts: aws-lib options

For type=request, fired just before a request is made to SimpleDB, the arguments are:

   * start: Date object, start time of request
   * action: string, name of SimpleDB action
   * query: full SimpleDB query

For type=handle, fired after each response from SimpleDB, the arguments are:

   * start: Date object, start time of request
   * action: string, name of SimpleDB action
   * query: full SimpleDB query
   * tryIndex: number of tries attempted, up to maxtry 
   * response: result from SimpleDB

For type=error, fired after any response with an error, the arguments are:

   * err: the error that occurred, an object like {Code:'...',Message:'...'}, where _Code_ is the Amazon error code
   * res: the result
   * meta: the request meta data

For type=status, fired after each retry, the arguments are:

   * done: true if request has finally succeeded
   * tryIndex: count of attempts
   * last: true if this was the last attempt
   * delay: delay in milliseconds until this attempt
   * err: any error that occurred


## Testing

The unit tests use expresso: [https://github.com/visionmedia/expresso]

    npm install expresso
    npm install eyes

To configure your keys, edit the test/keys.js file.
The tests are in test/simpledb.test.js


## Amazon AWS SimpleDB

Here's some more information on SimpleDB:


http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/