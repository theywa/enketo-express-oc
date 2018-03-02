/* global describe, require, it, beforeEach, afterEach */
'use strict';

// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

/* 
 * Some of these tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */
var request = require( 'supertest' );
var config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
var app = require( '../../config/express' );
var surveyModel = require( '../../app/models/survey-model' );
var instanceModel = require( '../../app/models/instance-model' );
var redis = require( 'redis' );
var client = redis.createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );


describe( 'api', function() {
    var validApiKey = 'abc';
    var validAuth = {
        'Authorization': 'Basic ' + new Buffer( validApiKey + ':' ).toString( 'base64' )
    };
    var invalidApiKey = 'def';
    var invalidAuth = {
        'Authorization': 'Basic ' + new Buffer( invalidApiKey + ':' ).toString( 'base64' )
    };
    var beingEdited = 'beingEdited';
    var validServer = 'https://testserver.com/bob';
    var validFormId = 'something';

    beforeEach( function( done ) {
        // add survey if it doesn't exist in the db
        surveyModel.set( {
            openRosaServer: validServer,
            openRosaId: validFormId,
        } ).then( function() {
            done();
        } );
    } );

    afterEach( function( done ) {
        /// select test database and flush it
        client.select( 15, function( err ) {
            if ( err ) {
                return done( err );
            }
            client.flushdb( function( err ) {
                if ( err ) {
                    return done( err );
                }
                return instanceModel.set( {
                    openRosaServer: validServer,
                    openRosaId: validFormId,
                    instanceId: beingEdited,
                    returnUrl: 'https://enketo.org',
                    instance: '<data></data>'
                } ).then( function() {
                    done();
                } );
            } );
        } );

    } );

    // return error if it fails
    function responseCheck( value, expected ) {
        if ( typeof expected === 'string' || typeof expected === 'number' ) {
            if ( value !== expected ) {
                return new Error( 'Response ' + value + ' not equal to ' + expected );
            }
        } else if ( expected instanceof RegExp && typeof value === 'object' ) {
            if ( !expected.test( JSON.stringify( value ) ) ) {
                return new Error( 'Response ' + JSON.stringify( value ) + ' not matching ' + expected );
            }
        } else if ( expected instanceof RegExp ) {
            if ( !expected.test( value ) ) {
                return new Error( 'Response ' + value + ' not matching ' + expected );
            }
        } else {
            return new Error( 'This is not a valid expected value' );
        }
    }

    function testResponse( test ) {
        var authDesc = test.auth === true ? 'valid' : ( test.auth === false ? 'invalid' : 'empty' );
        var auth = test.auth === true ? validAuth : ( test.auth === false ? invalidAuth : {} );
        var version = test.version;
        var server = ( typeof test.server !== 'undefined' ) ? test.server : validServer;
        var id = typeof test.id !== 'undefined' ? ( test.id !== '{{random}}' ? test.id : Math.floor( Math.random() * 10000 ).toString() ) : validFormId;
        var ret = test.ret === true ? 'http://example.com' : test.ret;
        var instance = test.instance === true ? '<data/>' : test.instance;
        var instanceId = test.instanceId === true ? 'UUID:' + Math.random() : test.instanceId;
        var endpoint = test.endpoint;
        var resProp = ( test.res && test.res.property ) ? test.res.property : 'url';
        var offlineEnabled = !!test.offline;
        var dataSendMethod = ( test.method === 'get' ) ? 'query' : 'send';

        it( test.method.toUpperCase() + ' /oc/api/v' + version + endpoint + ' with ' + authDesc + ' authentication and ' + server + ', ' +
            id + ', ' + ret + ', ' + instance + ', ' + instanceId + ', ' + test.theme +
            ', completeButton: ' + test.completeButton +
            ', parentWindowOrigin: ' + test.parentWindowOrigin + ', defaults: ' + JSON.stringify( test.defaults ) +
            ' responds with ' + test.status + ' when offline enabled: ' + offlineEnabled,
            function( done ) {
                app.set( 'offline enabled', offlineEnabled );

                request( app )[ test.method ]( '/oc/api/v' + version + endpoint )
                    .set( auth )[ dataSendMethod ]( {
                        server_url: server,
                        form_id: id,
                        instance: instance,
                        instance_id: instanceId,
                        complete_button: test.completeButton,
                        return_url: ret,
                        defaults: test.defaults,
                        parent_window_origin: test.parentWindowOrigin
                    } )
                    .expect( test.status )
                    .expect( function( resp ) {
                        if ( test.res && test.res.expected ) {
                            return responseCheck( resp.body[ resProp ], test.res.expected );
                        }
                    } )
                    .end( done );
            } );
    }

    describe( 'oc/api/v1 endpoints', function() {
        var version = '1';

        describe( '', function() {
            // POST /survey/single/fieldsubmission/iframe
            testResponse( {
                version: version,
                endpoint: '/survey/single/fieldsubmission/iframe',
                method: 'post',
                // test whether completeButton is ignored as it should be
                completeButton: true,
                ret: false,
                auth: true,
                status: 200,
                res: {
                    property: 'single_fieldsubmission_iframe_url',
                    expected: /\/single\/fs\/i\/::[A-z0-9]{4}$/
                },
                offline: false
            } );
            // with parent_window_origin
            testResponse( {
                version: version,
                endpoint: '/survey/single/fieldsubmission/iframe',
                method: 'post',
                parentWindowOrigin: 'http://example.com',
                ret: false,
                auth: true,
                status: 200,
                res: {
                    property: 'single_fieldsubmission_iframe_url',
                    expected: /\/single\/fs\/i\/::[A-z0-9]{4}\?parentWindowOrigin=http%3A%2F%2Fexample\.com$/
                },
                offline: false
            } );
            // POST /survey/single/fieldsubmission/c/iframe
            testResponse( {
                version: version,
                endpoint: '/survey/single/fieldsubmission/c/iframe',
                method: 'post',
                ret: false,
                auth: true,
                status: 200,
                res: {
                    property: 'single_fieldsubmission_iframe_url',
                    expected: /\/single\/fs\/c\/i\/::[A-z0-9]{32}$/
                },
                offline: false
            } );
        } );

        describe( '', function() {
            [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instanceId: 'AAA',
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_url',
                        // includes proper enketoID and not e.g. ::null 
                        expected: /::YYY/
                    }
                },
                // valid token and not being edited, but formId doesn't exist in db yet (no enketoId)
                {
                    method: 'post',
                    auth: true,
                    id: '{{random}}',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_url',
                        // includes proper enketoID and not e.g. ::null 
                        expected: /::YYY/
                    }
                },
                // already being edited
                {
                    method: 'post',
                    auth: true,
                    instanceId: beingEdited,
                    instance: true,
                    status: 405
                },
                // test return url in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'http://enke.to',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_url',
                        expected: /.+\?.*returnUrl=http%3A%2F%2Fenke.to/
                    }
                },
                // test completeButton in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'http://enke.to',
                    instanceId: true,
                    instance: true,
                    completeButton: 'true',
                    status: 201,
                    res: {
                        property: 'edit_url',
                        expected: /.+\?.*completeButton=true/
                    }
                },
                // test completeButton in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'http://enke.to',
                    completeButton: 'false',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_url',
                        expected: /.+\?.*completeButton=false/
                    }
                },
                // invalid parameters
                {
                    method: 'post',
                    auth: true,
                    id: '',
                    instanceId: true,
                    instance: true,
                    status: 400
                }, {
                    method: 'post',
                    auth: true,
                    instance: '',
                    instanceId: true,
                    status: 400
                }, {
                    method: 'post',
                    auth: true,
                    instanceId: '',
                    instance: true,
                    status: 400
                }, {
                    method: 'post',
                    auth: true,
                    instanceId: true,
                    instance: true,
                    server: '',
                    status: 400
                }
            ].map( function( obj ) {
                obj.version = version;
                obj.endpoint = '/instance/fieldsubmission/iframe';
                return obj;
            } ).forEach( testResponse );

            [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instanceId: 'AAA',
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_url',
                        // includes proper enketoID and not e.g. ::null 
                        expected: /\/edit\/fs\/c?\/i\/::[A-z0-9]{32}\?instance_id=AAA$/
                    }
                },
            ].map( function( obj ) {
                obj.version = version;
                obj.endpoint = '/instance/fieldsubmission/c/iframe';
                return obj;
            } ).forEach( testResponse );


            var readonlyInstanceTests = [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instanceId: 'AAA',
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_iframe_url',
                        // includes proper enketoID and not e.g. ::null 
                        expected: /\/edit\/fs\/dn(\/c)?\/i\/::[A-z0-9]{32}\?instance_id=AAA$/
                    }
                },
                // valid token and not being edited, but formId doesn't exist in db yet (no enketoId)
                {
                    method: 'post',
                    auth: true,
                    id: '{{random}}',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_iframe_url',
                        // includes proper enketoID and not e.g. ::null 
                        expected: /\/edit\/fs\/dn(\/c)?\/i\/::[A-z0-9]{32}\?instance_id/
                    }
                },
                // already being edited
                {
                    method: 'post',
                    auth: true,
                    instanceId: beingEdited,
                    instance: true,
                    status: 405
                },
                // test return url in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'http://enke.to',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_iframe_url',
                        expected: /.+\?.*returnUrl=http%3A%2F%2Fenke.to/
                    }
                },
                // test parentWindowOrigin
                {
                    method: 'post',
                    auth: true,
                    parentWindowOrigin: 'http://example.com',
                    ret: false,
                    instanceId: true,
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_iframe_url',
                        expected: /.+\?.*parentWindowOrigin=http%3A%2F%2Fexample\.com$/
                    },
                    offline: false
                },
                // test completeButton in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'http://enke.to',
                    completeButton: true,
                    instanceId: true,
                    instance: true,
                    status: 201,
                    res: {
                        property: 'edit_iframe_url',
                        expected: /.+\?.*completeButton=true/
                    }
                },
                // invalid parameters
                {
                    method: 'post',
                    auth: true,
                    id: '',
                    instanceId: true,
                    instance: true,
                    status: 400
                }, {
                    method: 'post',
                    auth: true,
                    instance: '',
                    instanceId: true,
                    status: 400
                }, {
                    method: 'post',
                    auth: true,
                    instanceId: '',
                    instance: true,
                    status: 400
                }, {
                    method: 'post',
                    auth: true,
                    instanceId: true,
                    instance: true,
                    server: '',
                    status: 400
                }
            ];

            readonlyInstanceTests.map( function( obj ) {
                obj.version = version;
                obj.endpoint = '/instance/fieldsubmission/note/iframe';
                return obj;
            } ).forEach( testResponse );

            readonlyInstanceTests.map( function( obj ) {
                obj.version = version;
                obj.endpoint = '/instance/fieldsubmission/note/c/iframe';
                return obj;
            } ).forEach( testResponse );
        } );
    } );
} );
