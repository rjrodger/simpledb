
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

      sdb.putItem('yourdomain', 'item1', {field1:'one', field2:'two'}, function( error ) {
      
        sdb.getItem('yourdomain', 'item1', function( error, result ) {
          console.log( 'field1 = '+result.field1 )
          console.log( 'field2 = '+result.field2 )
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

This module uses the standard callback convention. All functions take
a callback function as their last parameter. This callback function should accept three arguments:

    callback( error, result, meta )

Where error is object describing any errors that occured. If the
function was successful then error is null. So you check if error is
null to see if you can continue working:

    sdb.listDomains( functions( error, result, meta ) {
      if( error ) {
        console.log('listDomains failed: '+error.Message )
      }
      else {
        // do stuff with result, an array of domain names
      }
    })

The result parameter contains the results of a successful action and
its nature depends on the action. It could be a string, and array or
and object.

The meta parameter contains a description of the request, including the underlying details from Amazon.

    console.log( JSON.stringify(meta) )


## API

    var sdb = new simpledb.SimpleDB( options, logger )

Create a new SimpleDB wrapper. The options parameter gives you control
over the requests. The logger parameter receives logging events so
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


Logging

Provide a logger callback when you are creating the simpledb.SimpleDB
object to get notifications of request processing events. A simple logger that
prints to STDOUT is provided by simpledb.debuglogger:

    var sdb = new simpledb.SimpleDB( {...}, simpledb.debuglogger )

The logger callback accepts the following parameters:
    logger( type, date, ... )
 * type: string, one of create, request, handle, status
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

For type=status, fired after each retry, the arguments are:
 * done: true if request has finally succeeded
 * tryIndex: count of attempts
 * last: true if this was the last attempt
 * delay: delay in milliseconds until this attempt
 * err: any error that occurred


## Testing

The unit tests use expresso.

   npm install expresso
   npm install eyes

To configure your keys, edit the test/keys.js file.
The tests are in test/simpledb.test.js


## Amazon AWS SimpleDB

Here's some more information on SimpleDB:


http://docs.amazonwebservices.com/AmazonSimpleDB/latest/DeveloperGuide/