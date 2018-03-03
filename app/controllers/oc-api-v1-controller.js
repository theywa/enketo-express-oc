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
// var debug = require( 'debug' )( 'api-controller-v2' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/oc/api/v1`, router );
};

router
    .get( '/', ( req, res ) => {
        res.redirect( 'https://github.com/OpenClinica/enketo-express-oc/blob/master/doc/oc-api.md' );
    } )
    .all( '*', authCheck )
    .all( '*', _setQuotaUsed )
    .all( '*', _setDefaultsQueryParam )
    .all( '*', _setReturnQueryParam )
    .all( '*', _setGoToHash )
    .all( '*', _setParentWindow )
    .all( '/survey/preview*', ( req, res, next ) => {
        req.webformType = 'preview';
        next();
    } )
    .all( '/instance*', ( req, res, next ) => {
        req.webformType = 'edit';
        next();
    } )
    .all( '*/c', ( req, res, next ) => {
        req.dnClose = true;
        next();
    } )
    .all( '/survey/view*', ( req, res, next ) => {
        req.webformType = 'view';
        next();
    } )
    .all( '/instance/view*', ( req, res, next ) => {
        req.webformType = 'view-instance';
        next();
    } )
    .all( '/instance/note*', ( req, res, next ) => {
        req.webformType = 'view-instance-dn';
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
    .post( '/instance/note', cacheInstance )
    .post( '/instance/note/c', cacheInstance )
    .all( '*', ( req, res, next ) => {
        const error = new Error( 'Not allowed.' );
        error.status = 405;
        next( error );
    } );

function authCheck( req, res, next ) {
    // check authentication and account
    let error;
    const creds = auth( req );
    const key = ( creds ) ? creds.name : undefined;
    const server = req.body.server_url || req.query.server_url;

    // set content-type to json to provide appropriate json Error responses
    res.set( 'Content-Type', 'application/json' );

    account.get( server )
        .then( account => {
            if ( !key || ( key !== account.key ) ) {
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
        openRosaServer: req.body.server_url || req.query.server_url,
        openRosaId: req.body.form_id || req.query.form_id,
        theme: req.body.theme || req.query.theme
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
    const map = req.body.defaults || req.query.defaults;

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
    const goTo = req.body.go_to || req.query.go_to;
    req.goTo = ( goTo ) ? `#${goTo}` : '';

    next();
}

function _setParentWindow( req, res, next ) {
    const parentWindowOrigin = req.body.parent_window_origin || req.query.parent_window_origin;

    if ( parentWindowOrigin ) {
        req.parentWindowOriginParam = `parentWindowOrigin=${encodeURIComponent( decodeURIComponent( parentWindowOrigin ) )}`;
    }
    next();
}

function _setReturnQueryParam( req, res, next ) {
    const returnUrl = req.body.return_url || req.query.return_url;

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

function _generateQueryString( params ) {
    let paramsJoined;

    params = params || [];

    paramsJoined = params.filter( part => part && part.length > 0 ).join( '&' );

    return paramsJoined ? `?${paramsJoined}` : '';
}

function _generateWebformUrls( id, req ) {
    let queryString;
    let url;
    const IFRAMEPATH = 'i/';
    const iframePart = IFRAMEPATH;
    const FSPATH = 'fs/';
    const fsPart = FSPATH;
    const dnClosePart = ( req.dnClose ) ? 'c/' : '';
    const hash = req.goTo;

    const protocol = req.headers[ 'x-forwarded-proto' ] || req.protocol;
    const baseUrl = `${protocol}://${req.headers.host}${req.app.get( 'base path' )}/`;
    const idPartOnline = `::${id}`;
    const idPartOnce = `::${utils.insecureAes192Encrypt( id, keys.singleOnce )}`;
    const idPartView = `::${utils.insecureAes192Encrypt( id, keys.view )}`;
    const idPartViewDn = `::${utils.insecureAes192Encrypt( id, keys.viewDn )}`;
    const idPartViewDnc = `::${utils.insecureAes192Encrypt( id, keys.viewDnc )}`;
    const idPartFsC = `::${utils.insecureAes192Encrypt( id, keys.fsC )}`;
    let queryParts;

    req.webformType = req.webformType || 'default';

    switch ( req.webformType ) {
        case 'preview':
            queryString = _generateQueryString( [ req.defaultsQueryParam, req.parentWindowOriginParam ] );
            url = `${baseUrl}preview/${iframePart}${idPartOnline}${queryString}${hash}`;
            break;
        case 'edit':
            // no defaults query parameter in edit view
            queryString = _generateQueryString( [ `instance_id=${req.body.instance_id}`, req.parentWindowOriginParam, req.returnQueryParam, req.completeButtonParam, req.reasonForChangeParam ] );
            url = `${baseUrl}edit/${fsPart}${dnClosePart}${iframePart}${dnClosePart ? idPartFsC : idPartOnline}${queryString}${hash}`;
            break;
        case 'single':
            queryParts = [ req.defaultsQueryParam, req.returnQueryParam ];
            if ( iframePart ) {
                queryParts.push( req.parentWindowOriginParam );
            }
            queryString = _generateQueryString( queryParts );
            if ( !req.fieldSubmission ) {
                url = `${baseUrl}single/${iframePart}${req.multipleAllowed === false ? idPartOnce : idPartOnline}${queryString}`;
            } else {
                url = `${baseUrl}single/${fsPart}${dnClosePart}${iframePart}${dnClosePart ? idPartFsC : idPartOnline}${queryString}`;
            }
            break;
        case 'view':
        case 'view-instance':
            queryParts = [];
            if ( req.webformType === 'view-instance' ) {
                queryParts.push( `instance_id=${req.body.instance_id}` );
            }
            if ( iframePart ) {
                queryParts.push( req.parentWindowOriginParam );
            }
            queryParts.push( req.returnQueryParam );
            queryString = _generateQueryString( queryParts );
            url = `${baseUrl}view/${iframePart}${idPartView}${queryString}${hash}`;
            break;
        case 'view-instance-dn':
            // inside {block} to properly scope for new variables (eslint)
            {
                const viewId = dnClosePart ? idPartViewDnc : idPartViewDn;
                const viewPath = `edit/${FSPATH}dn/`;
                queryParts = [ `instance_id=${req.body.instance_id}`, req.completeButtonParam ];
                if ( iframePart ) {
                    queryParts.push( req.parentWindowOriginParam );
                }
                queryParts.push( req.returnQueryParam );
                queryString = _generateQueryString( queryParts );
                url = baseUrl + viewPath + dnClosePart + iframePart + viewId + queryString + hash;
                break;
            }
        default:
            // TODO: is this used?
            queryString = _generateQueryString( [ req.defaultsQueryParam, req.parentWindowOriginParam ] );
            if ( iframePart ) {
                url = baseUrl + iframePart + idPartOnline + queryString;
            } else {
                url = baseUrl + idPartOnline + queryString;
            }

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
