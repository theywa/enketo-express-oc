/* global describe, require, it, beforeEach, afterEach */
// safer to ensure this here (in addition to grunt:env:test)
process.env.NODE_ENV = 'test';

/* 
 * Some of these tests use the special test Api Token and Server URLs defined in the API spec
 * at http://apidocs.enketo.org.
 */
const request = require( 'supertest' );
const config = require( '../../app/models/config-model' ).server;
config[ 'base path' ] = '';
const app = require( '../../config/express' );
const surveyModel = require( '../../app/models/survey-model' );
const instanceModel = require( '../../app/models/instance-model' );
const redis = require( 'redis' );
const client = redis.createClient( config.redis.main.port, config.redis.main.host, {
    auth_pass: config.redis.main.password
} );


describe( 'api', () => {
    const validApiKey = 'abc';
    const validAuth = {
        'Authorization': `Basic ${new Buffer( `${validApiKey}:` ).toString( 'base64' )}`
    };
    const invalidApiKey = 'def';
    const invalidAuth = {
        'Authorization': `Basic ${new Buffer( `${invalidApiKey}:` ).toString( 'base64' )}`
    };
    const beingEdited = 'beingEdited';
    const validServer = 'https://testserver.com/bob';
    const validFormId = 'something';

    beforeEach( done => {
        // add survey if it doesn't exist in the db
        surveyModel.set( {
            openRosaServer: validServer,
            openRosaId: validFormId,
        } ).then( () => {
            done();
        } );
    } );

    afterEach( done => {
        /// select test database and flush it
        client.select( 15, err => {
            if ( err ) {
                return done( err );
            }
            client.flushdb( err => {
                if ( err ) {
                    return done( err );
                }
                return instanceModel.set( {
                    openRosaServer: validServer,
                    openRosaId: validFormId,
                    instanceId: beingEdited,
                    returnUrl: 'https://enketo.org',
                    instance: '<data></data>'
                } ).then( () => {
                    done();
                } );
            } );
        } );

    } );

    // return error if it fails
    function responseCheck( value, expected ) {
        if ( typeof expected === 'string' || typeof expected === 'number' ) {
            if ( value !== expected ) {
                return new Error( `Response ${value} not equal to ${expected}` );
            }
        } else if ( expected instanceof RegExp && typeof value === 'object' ) {
            if ( !expected.test( JSON.stringify( value ) ) ) {
                return new Error( `Response ${JSON.stringify( value )} not matching ${expected}` );
            }
        } else if ( expected instanceof RegExp ) {
            if ( !expected.test( value ) ) {
                return new Error( `Response ${value} not matching ${expected}` );
            }
        } else {
            return new Error( 'This is not a valid expected value' );
        }
    }

    function testResponse( test ) {
        const authDesc = test.auth === true ? 'valid' : ( test.auth === false ? 'invalid' : 'empty' );
        const auth = test.auth === true ? validAuth : ( test.auth === false ? invalidAuth : {} );
        const version = test.version;
        const server = ( typeof test.server !== 'undefined' ) ? test.server : validServer;
        const id = typeof test.id !== 'undefined' ? ( test.id !== '{{random}}' ? test.id : Math.floor( Math.random() * 10000 ).toString() ) : validFormId;
        const ret = test.ret === true ? 'http://example.com' : test.ret;
        const instance = test.instance === true ? '<data/>' : test.instance;
        const instanceId = test.instanceId === true ? `UUID:${Math.random()}` : test.instanceId;
        const endpoint = test.endpoint;
        const dataSendMethod = ( test.method === 'get' ) ? 'query' : 'send';

        it( `${test.method.toUpperCase()} /oc/api/v${version}${endpoint} with ${authDesc} authentication and ${server}, ${id}, ${ret}, ${instance}, ${instanceId}, ${test.theme}, completeButton: ${test.completeButton}, parentWindowOrigin: ${test.parentWindowOrigin}, defaults: ${JSON.stringify( test.defaults )} responds with ${test.status}`,
            done => {

                request( app )[ test.method ]( `/oc/api/v${version}${endpoint}` )
                    .set( auth )[ dataSendMethod ]( {
                        server_url: server,
                        form_id: id,
                        instance,
                        instance_id: instanceId,
                        complete_button: test.completeButton,
                        return_url: ret,
                        defaults: test.defaults,
                        parent_window_origin: test.parentWindowOrigin
                    } )
                    .expect( test.status )
                    .expect( resp => {
                        if ( test.expected ) {
                            return responseCheck( resp.body.url, test.expected );
                        }
                    } )
                    .end( done );
            } );
    }

    describe( 'oc/api/v1 endpoints', () => {
        const version = '1';

        describe( '', () => {
            // POST /survey/collect
            testResponse( {
                version,
                endpoint: '/survey/collect',
                method: 'post',
                // test whether completeButton is ignored as it should be
                completeButton: true,
                ret: false,
                auth: true,
                status: 200,
                expected: /\/single\/fs\/i\/::[A-z0-9]{4}$/,
            } );
            // GET /survey/collect
            testResponse( {
                version,
                endpoint: '/survey/collect',
                method: 'get',
                ret: false,
                auth: true,
                status: 405
            } );
            // POST /survey/collect with parent_window_origin
            testResponse( {
                version,
                endpoint: '/survey/collect',
                method: 'post',
                parentWindowOrigin: 'http://example.com',
                ret: false,
                auth: true,
                status: 200,
                expected: /\/single\/fs\/i\/::[A-z0-9]{4}\?parentWindowOrigin=http%3A%2F%2Fexample\.com$/,
            } );
            // POST /survey/collect/c
            testResponse( {
                version,
                endpoint: '/survey/collect/c',
                method: 'post',
                ret: false,
                auth: true,
                status: 200,
                expected: /\/single\/fs\/c\/i\/::[A-z0-9]{32}$/,
            } );
            // with parent_window_origin
            testResponse( {
                version,
                endpoint: '/survey/collect/c',
                method: 'post',
                parentWindowOrigin: 'http://example.com',
                ret: false,
                auth: true,
                status: 200,
                expected: /\/single\/fs\/c\/i\/::[A-z0-9]{32}\?parentWindowOrigin=http%3A%2F%2Fexample\.com$/,
            } );
            // POST /survey/view
            testResponse( {
                version,
                endpoint: '/survey/view',
                method: 'post',
                ret: false,
                auth: true,
                status: 200,
                expected: /\/view\/i\/::[A-z0-9]{32}$/,

            } );
            // POST /survey/preview
            testResponse( {
                version,
                endpoint: '/survey/preview',
                method: 'post',
                ret: false,
                auth: true,
                status: 200,
                expected: /\/preview\/i\/::[A-z0-9]{4}$/,
            } );
        } );

        describe( '', () => {
            [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instanceId: 'AAA',
                    instance: true,
                    status: 201,
                    // includes proper enketoID and not e.g. ::null 
                    expected: /::YYY/
                },
                // valid token and not being edited, but formId doesn't exist in db yet (no enketoId)
                {
                    method: 'post',
                    auth: true,
                    id: '{{random}}',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    // includes proper enketoID and not e.g. ::null 
                    expected: /::YYY/
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
                    ret: 'https://enke.to',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    expected: /.+\?.*returnUrl=https%3A%2F%2Fenke.to/,
                },
                // test completeButton in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'https://enke.to',
                    instanceId: true,
                    instance: true,
                    completeButton: 'true',
                    status: 201,
                    expected: /.+\?.*completeButton=true/
                },
                // test completeButton in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'https://enke.to',
                    completeButton: 'false',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    expected: /.+\?.*completeButton=false/
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
            ].map( obj => {
                obj.version = version;
                obj.endpoint = '/instance/edit';
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
                    // includes proper enketoID and not e.g. ::null 
                    expected: /\/edit\/fs\/c?\/i\/::[A-z0-9]{32}\?instance_id=AAA$/
                },
            ].map( obj => {
                obj.version = version;
                obj.endpoint = '/instance/edit/c';
                return obj;
            } ).forEach( testResponse );


            const noteOnlyInstanceTests = [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instanceId: 'AAA',
                    instance: true,
                    status: 201,
                    // includes proper enketoID and not e.g. ::null 
                    expected: /\/edit\/fs\/dn(\/c)?\/i\/::[A-z0-9]{32}\?instance_id=AAA$/
                },
                // valid token and not being edited, but formId doesn't exist in db yet (no enketoId)
                {
                    method: 'post',
                    auth: true,
                    id: '{{random}}',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    // includes proper enketoID and not e.g. ::null 
                    expected: /\/edit\/fs\/dn(\/c)?\/i\/::[A-z0-9]{32}\?instance_id/
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
                    ret: 'https://enke.to',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    expected: /.+\?.*returnUrl=https%3A%2F%2Fenke.to/
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
                    expected: /.+\?.*parentWindowOrigin=http%3A%2F%2Fexample\.com$/,

                },
                // test completeButton in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'https://enke.to',
                    completeButton: true,
                    instanceId: true,
                    instance: true,
                    status: 201,
                    expected: /.+\?.*completeButton=true/
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

            noteOnlyInstanceTests.map( obj => {
                obj.version = version;
                obj.endpoint = '/instance/note';
                return obj;
            } ).forEach( testResponse );

            noteOnlyInstanceTests.map( obj => {
                obj.version = version;
                obj.endpoint = '/instance/note/c';
                return obj;
            } ).forEach( testResponse );

            // Readonly tests
            [
                // valid token
                {
                    method: 'post',
                    auth: true,
                    instanceId: 'AAA',
                    instance: true,
                    status: 201,
                    // includes proper enketoID and not e.g. ::null 
                    expected: /\/view\/i\/::[A-z0-9]{32}\?instance_id=AAA$/
                },
                // valid token and not being edited, but formId doesn't exist in db yet (no enketoId)
                {
                    method: 'post',
                    auth: true,
                    id: '{{random}}',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    // includes proper enketoID and not e.g. ::null 
                    expected: /\/view\/i\/::[A-z0-9]{32}\?instance_id/
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
                    ret: 'https://enke.to',
                    instanceId: true,
                    instance: true,
                    status: 201,
                    expected: /.+\?.*returnUrl=https%3A%2F%2Fenke.to/
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
                    expected: /.+\?.*parentWindowOrigin=http%3A%2F%2Fexample\.com$/,
                },
                // test ignoring completeButton in response
                {
                    method: 'post',
                    auth: true,
                    ret: 'https://enke.to',
                    completeButton: true,
                    instanceId: true,
                    instance: true,
                    status: 201,
                    expected: /\/view\/i\/::[A-z0-9]{32}\?instance_id/
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
            ].map( obj => {
                obj.version = version;
                obj.endpoint = '/instance/view';
                return obj;
            } ).forEach( testResponse );
        } );
    } );
} );
