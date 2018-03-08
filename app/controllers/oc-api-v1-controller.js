const surveyModel = require( '../models/survey-model' );
const instanceModel = require( '../models/instance-model' );
const cacheModel = require( '../models/cache-model' );
const account = require( '../models/account-model' );
const auth = require( 'basic-auth' );
const express = require( 'express' );
const utils = require( '../lib/utils' );
const keys = require( '../lib/router-utils' ).idEncryptionKeys;
const router = express.Router();
const quotaErrorMessage = 'Forbidden. No quota left';
// var debug = require( 'debug' )( 'oc-api-controller-v1' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/oc/api/v1`, router );
};

router
    .get( '/', ( req, res ) => {
        res.redirect( 'https://github.com/OpenClinica/enketo-express-oc/blob/master/doc/oc-api.md' );
    } )
    .post( '*', authCheck )
    .delete( '*', authCheck )
    .post( '*', _setQuotaUsed )
    .post( '*', _setDefaultsQueryParam )
    .post( '*', _setReturnQueryParam )
    .post( '*', _setGoToHash )
    .post( '*', _setParentWindow )
    .post( '/survey/preview*', ( req, res, next ) => {
        req.webformType = 'preview';
        next();
    } )
    .post( '/instance*', ( req, res, next ) => {
        req.webformType = 'edit';
        next();
    } )
    .post( '*/c', ( req, res, next ) => {
        req.dnClose = true;
        next();
    } )
    .post( '/survey/view*', ( req, res, next ) => {
        req.webformType = 'view';
        next();
    } )
    .post( '/instance/view*', ( req, res, next ) => {
        req.webformType = 'view-instance';
        next();
    } )
    .post( '/instance/note*', ( req, res, next ) => {
        req.webformType = 'view-instance-dn';
        next();
    } )
    .post( '/instance/edit/rfc*', ( req, res, next ) => {
        req.webformType = 'rfc';
        next();
    } )
    .delete( '/survey/cache', emptySurveyCache )
    .post( '/survey/preview', getNewOrExistingSurvey )
    .post( '/survey/view', getNewOrExistingSurvey )
    .post( '/survey/collect', getNewOrExistingSurvey )
    .post( '/survey/collect/c', getNewOrExistingSurvey )
    .delete( '/instance/', removeInstance )
    .post( '/instance/*', _setCompleteButtonParam )
    .post( '/instance/view', cacheInstance )
    .post( '/instance/edit', cacheInstance )
    .post( '/instance/edit/c', cacheInstance )
    .post( '/instance/edit/rfc', cacheInstance )
    .post( '/instance/edit/rfc/c', cacheInstance )
    .post( '/instance/note', cacheInstance )
    .post( '/instance/note/c', cacheInstance )
    .all( '*', ( req, res, next ) => {
        const error = new Error( 'Not allowed.' );
        error.status = 405;
        next( error );
    } );


// API uses Basic authentication with just the username
function authCheck( req, res, next ) {
    // check authentication and account
    let error;
    const creds = auth( req );
    const key = ( creds ) ? creds.name : undefined;
    const server = req.body.server_url;

    // set content-type to json to provide appropriate json Error responses
    res.set( 'Content-Type', 'application/json' );

    account.get( server )
        .then( account => {
            if ( !key || key !== account.key ) {
                error = new Error( 'Not Allowed. Invalid API key.' );
                error.status = 401;
                res
                    .status( error.status )
                    .set( 'WWW-Authenticate', 'Basic realm="Enter valid API key as user name"' );
                next( error );
            } else {
                req.account = account;
                next();
            }
        } )
        .catch( next );
}

function getNewOrExistingSurvey( req, res, next ) {
    let status;
    const survey = {
        openRosaServer: req.body.server_url,
        openRosaId: req.body.form_id,
        theme: req.body.theme
    };

    if ( req.account.quota < req.account.quotaUsed ) {
        return _render( 403, quotaErrorMessage, res );
    }

    return surveyModel
        .getId( survey ) // will return id only for existing && active surveys
        .then( id => {
            if ( !id && req.account.quota <= req.account.quotaUsed ) {
                return _render( 403, quotaErrorMessage, res );
            }
            status = ( id ) ? 200 : 201;
            // even if id was found still call .set() method to update any properties
            return surveyModel.set( survey )
                .then( id => {
                    if ( id ) {
                        _render( status, _generateWebformUrls( id, req ), res );
                    } else {
                        _render( 404, 'Survey not found.', res );
                    }
                } );
        } )
        .catch( next );
}

function emptySurveyCache( req, res, next ) {

    return cacheModel
        .flush( {
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id
        } )
        .then( () => {
            _render( 204, null, res );
        } )
        .catch( next );
}

function cacheInstance( req, res, next ) {
    let survey;
    let enketoId;

    if ( req.account.quota < req.account.quotaUsed ) {
        return _render( 403, quotaErrorMessage, res );
    }

    survey = {
        openRosaServer: req.body.server_url,
        openRosaId: req.body.form_id,
        instance: req.body.instance,
        instanceId: req.body.instance_id,
        returnUrl: req.body.return_url,
        instanceAttachments: req.body.instance_attachments
    };

    return surveyModel
        .getId( survey )
        .then( id => {
            if ( !id && req.account.quota <= req.account.quotaUsed ) {
                return _render( 403, quotaErrorMessage, res );
            }
            // Create a new enketo ID.
            if ( !id ) {
                return surveyModel.set( survey );
            }
            // Do not update properties if ID was found to avoid overwriting theme.
            return id;
        } )
        .then( id => {
            enketoId = id;
            return instanceModel.set( survey );
        } )
        .then( () => {
            _render( 201, _generateWebformUrls( enketoId, req ), res );
        } )
        .catch( next );
}

function removeInstance( req, res, next ) {

    return instanceModel
        .remove( {
            openRosaServer: req.body.server_url,
            openRosaId: req.body.form_id,
            instanceId: req.body.instance_id
        } )
        .then( instanceId => {
            if ( instanceId ) {
                _render( 204, null, res );
            } else {
                _render( 404, 'Record not found.', res );
            }
        } )
        .catch( next );
}

function _setQuotaUsed( req, res, next ) {
    surveyModel
        .getNumber( req.account.linkedServer )
        .then( number => {
            req.account.quotaUsed = number;
            next();
        } )
        .catch( next );
}

function _setDefaultsQueryParam( req, res, next ) {
    let queryParam = '';
    const map = req.body.defaults;

    if ( map ) {
        for ( const prop in map ) {
            if ( map.hasOwnProperty( prop ) ) {
                queryParam += `d[${encodeURIComponent( decodeURIComponent( prop ) )}]=${encodeURIComponent( decodeURIComponent( map[ prop ] ) )}&`;
            }
        }
        req.defaultsQueryParam = queryParam.substring( 0, queryParam.length - 1 );
    }

    next();
}

function _setGoToHash( req, res, next ) {
    const goTo = req.body.go_to;
    req.goTo = ( goTo ) ? `#${goTo}` : '';

    next();
}

function _setParentWindow( req, res, next ) {
    const parentWindowOrigin = req.body.parent_window_origin;

    if ( parentWindowOrigin ) {
        req.parentWindowOriginParam = `parentWindowOrigin=${encodeURIComponent( decodeURIComponent( parentWindowOrigin ) )}`;
    }
    next();
}

function _setReturnQueryParam( req, res, next ) {
    const returnUrl = req.body.return_url;

    if ( returnUrl ) {
        req.returnQueryParam = `returnUrl=${encodeURIComponent( decodeURIComponent( returnUrl ) )}`;
    }
    next();
}

function _setCompleteButtonParam( req, res, next ) {
    const completeButton = req.body.complete_button;

    if ( completeButton ) {
        req.completeButtonParam = `completeButton=${completeButton}`;
    }
    next();
}

function _generateQueryString( params = [] ) {
    let paramsJoined;

    paramsJoined = params.filter( part => part && part.length > 0 ).join( '&' );

    return paramsJoined ? `?${paramsJoined}` : '';
}

function _generateWebformUrls( id, req ) {
    const IFRAMEPATH = 'i/';
    const FSPATH = 'fs/';
    const dnClosePart = ( req.dnClose ) ? 'c/' : '';
    const hash = req.goTo;
    const protocol = req.headers[ 'x-forwarded-proto' ] || req.protocol;
    const BASEURL = `${protocol}://${req.headers.host}${req.app.get( 'base path' )}/`;
    const idPartOnline = `::${id}`;
    const idPartView = `::${utils.insecureAes192Encrypt( id, keys.view )}`;
    const idPartViewDn = `::${utils.insecureAes192Encrypt( id, keys.viewDn )}`;
    const idPartViewDnc = `::${utils.insecureAes192Encrypt( id, keys.viewDnc )}`;
    const idPartEditRfc = `::${utils.insecureAes192Encrypt( id, keys.editRfc )}`;
    const idPartFsC = `::${utils.insecureAes192Encrypt( id, keys.fsC )}`;
    let url;

    req.webformType = req.webformType || 'single';

    switch ( req.webformType ) {
        case 'preview':
            {
                const queryString = _generateQueryString( [ req.defaultsQueryParam, req.parentWindowOriginParam ] );
                url = `${BASEURL}preview/${IFRAMEPATH}${idPartOnline}${queryString}${hash}`;
                break;
            }
        case 'edit':
            {
                const editId = dnClosePart ? idPartFsC : idPartOnline;
                const queryString = _generateQueryString( [ `instance_id=${req.body.instance_id}`, req.parentWindowOriginParam, req.returnQueryParam, req.completeButtonParam ] );
                url = `${BASEURL}edit/${FSPATH}${dnClosePart}${IFRAMEPATH}${editId}${queryString}${hash}`;
                break;
            }
        case 'rfc':
            {
                const queryString = _generateQueryString( [ `instance_id=${req.body.instance_id}`, req.parentWindowOriginParam, req.returnQueryParam ] );
                url = `${BASEURL}edit/${FSPATH}rfc/${dnClosePart}${IFRAMEPATH}${idPartEditRfc}${queryString}${hash}`;
                break;
            }
        case 'single':
            {
                const queryString = _generateQueryString( [ req.defaultsQueryParam, req.returnQueryParam, req.parentWindowOriginParam ] );
                url = `${BASEURL}single/${FSPATH}${dnClosePart}${IFRAMEPATH}${dnClosePart ? idPartFsC : idPartOnline}${queryString}`;
                break;
            }
        case 'view':
        case 'view-instance':
            {
                const queryParts = [ req.parentWindowOriginParam, req.returnQueryParam ];
                if ( req.webformType === 'view-instance' ) {
                    queryParts.unshift( `instance_id=${req.body.instance_id}` );
                }
                const queryString = _generateQueryString( queryParts );
                url = `${BASEURL}view/${IFRAMEPATH}${idPartView}${queryString}${hash}`;
                break;
            }
        case 'view-instance-dn':
            // inside {block} to properly scope for new variables (eslint)
            {
                const viewId = dnClosePart ? idPartViewDnc : idPartViewDn;
                const queryString = _generateQueryString( [ `instance_id=${req.body.instance_id}`, req.completeButtonParam, req.parentWindowOriginParam, req.returnQueryParam ] );
                url = `${BASEURL}edit/${FSPATH}dn/${dnClosePart}${IFRAMEPATH}${viewId}${queryString}${hash}`;
                break;
            }
        default:
            url = 'Could not generate a webform URL. Unknown webform type.';

            break;
    }

    return { url };
}

function _render( status, body, res ) {
    if ( status === 204 ) {
        // send 204 response without a body
        res.status( status ).end();
    } else {
        body = body || {};
        if ( typeof body === 'string' ) {
            body = {
                message: body
            };
        }
        body.code = status;
        res.status( status ).json( body );
    }
}
