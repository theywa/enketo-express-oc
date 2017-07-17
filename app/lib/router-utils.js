'use strict';

var utils = require( './utils' );
var config = require( '../models/config-model' ).server;
var keys = {
    singleOnce: config[ 'less secure encryption key' ],
    view: config[ 'less secure encryption key' ] + 'view',
    viewDn: config[ 'less secure encryption key' ] + 'view-dn',
    viewDnc: config[ 'less secure encryption key' ] + 'view-dnc',
    fsC: config[ 'less secure encryption key' ] + 'fs-c',
};

function enketoIdParam( req, res, next, id ) {
    if ( /^::[A-z0-9]{4,8}$/.test( id ) ) {
        req.enketoId = id.substring( 2 );
        next();
    } else {
        next( 'route' );
    }
}

function encryptedEnketoIdParamSingle( req, res, next, id ) {
    _encryptedEnketoIdParam( req, res, next, id, keys.singleOnce );
}

function encryptedEnketoIdParamView( req, res, next, id ) {
    _encryptedEnketoIdParam( req, res, next, id, keys.view );
}

function encryptedEnketoIdParamViewDn( req, res, next, id ) {
    _encryptedEnketoIdParam( req, res, next, id, keys.viewDn );
}

function encryptedEnketoIdParamViewDnc( req, res, next, id ) {
    _encryptedEnketoIdParam( req, res, next, id, keys.viewDnc );
}

function encryptedEnketoIdParamFsC( req, res, next, id ) {
    _encryptedEnketoIdParam( req, res, next, id, keys.fsC );
}

function _encryptedEnketoIdParam( req, res, next, id, key ) {
    // either 32 or 64 hexadecimal characters
    if ( /^::([0-9a-fA-F]{32}$|[0-9a-fA-F]{64})$/.test( id ) ) {
        req.encryptedEnketoId = id.substring( 2 );
        try {
            // Just see if it can be decrypted. Storing the encrypted value might
            // increases chance of leaking underlying enketo_id but for now this is used
            // in the submission controller and transformation controller.
            req.enketoId = utils.insecureAes192Decrypt( id.substring( 2 ), key );
            next();
        } catch ( e ) {
            // console.error( 'Could not decrypt:', req.encryptedEnketoId );
            next( 'route' );
        }
    } else {
        next( 'route' );
    }
}

module.exports = {
    enketoId: enketoIdParam,
    idEncryptionKeys: keys,
    encryptedEnketoIdSingle: encryptedEnketoIdParamSingle,
    encryptedEnketoIdView: encryptedEnketoIdParamView,
    encryptedEnketoIdViewDn: encryptedEnketoIdParamViewDn,
    encryptedEnketoIdViewDnc: encryptedEnketoIdParamViewDnc,
    encryptedEnketoIdFsC: encryptedEnketoIdParamFsC,
};
