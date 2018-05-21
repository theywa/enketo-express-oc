'use strict';

require( './module/promise-by-Q' );
require( './module/Array-from' );
require( './module/Array-includes' );
require( './module/radio-tab' );
// Workaround for https://github.com/kobotoolbox/enketo-express/issues/990
// This can probably be removed in the future. Test modal dialogs called from file input widget (when resetting).
require( './module/dialog' );

var $ = require( 'jquery' );
var gui = require( './module/gui' );
var controller = require( './module/controller-webform-fieldsubmission' );
var settings = require( './module/settings' );
var connection = require( './module/connection' );
var translator = require( './module/translator' );
var t = translator.t;
var $loader = $( 'body > .main-loader' );
var $formheader = $( '.main > .paper > .form-header' );
var oc = require( './module/custom' );
var $footer = $( '.form-footer' );
var survey = {
    enketoId: settings.enketoId,
    serverUrl: settings.serverUrl,
    xformId: settings.xformId,
    xformUrl: settings.xformUrl,
    instanceId: settings.instanceId
};
var loadWarnings = [];

translator.init( survey )
    .then( connection.getFormParts )
    .then( function( formParts ) {
        if ( location.pathname.indexOf( '/edit/' ) > -1 || location.pathname.indexOf( '/view/' ) > -1 ) {
            if ( survey.instanceId ) {
                return connection.getExistingInstance( survey )
                    .then( function( response ) {
                        formParts.instance = response.instance;
                        formParts.instanceAttachments = response.instanceAttachments;
                        // TODO: this will fail massively if instanceID is not populated (will use POST instead of PUT). Maybe do a check?
                        return formParts;
                    } );
            } else if ( location.pathname.indexOf( '/edit/' ) > -1 ) {
                throw new Error( 'This URL is invalid' );
            }
        }
        return formParts;
    } )
    .then( function( formParts ) {
        if ( formParts.form && formParts.model ) {
            return gui.swapTheme( formParts );
        } else {
            throw new Error( t( 'error.unknown' ) );
        }
    } )
    .then( function( formParts ) {
        if ( /\/fs\/dnc?\//.test( window.location.pathname ) ) {
            return _readonlify( formParts, true );
        } else if ( /\/view\//.test( window.location.pathname ) ) {
            return _readonlify( formParts, false );
        }
        return formParts;
    } )
    .then( _init )
    .then( connection.getMaximumSubmissionSize )
    .then( _updateMaxSizeSetting )
    .catch( _showErrorOrAuthenticate );

function _updateMaxSizeSetting( maxSize ) {
    if ( maxSize ) {
        // overwrite default max size
        settings.maxSize = maxSize;
        $( 'form.or' ).trigger( 'updateMaxSize' );
    }
}

function _showErrorOrAuthenticate( error ) {
    $loader.addClass( 'fail' );
    if ( error.status === 401 ) {
        window.location.href = '/login?return_url=' + encodeURIComponent( window.location.href );
    } else {
        gui.alert( error.message, t( 'alert.loaderror.heading' ) );
    }
}

/**
 * Converts questions to readonly
 * Disables calculations, deprecatedID mechanism and preload items.
 * 
 * @param  {[type]} formParts [description]
 * @return {[type]}           [description]
 */
function _readonlify( formParts, notesEnabled ) {
    // Styling changes
    $( 'body' ).addClass( 'oc-view' );

    // Partially disable calculations in Enketo Core
    console.log( 'Calculations restricted to clinicaldata only.' );
    var calculationModule = require( 'enketo-core/src/js/calculation' );
    calculationModule.originalUpdate = calculationModule.update;
    calculationModule.update = function( updated ) {
        return calculationModule.originalUpdate.call( this, updated, '[oc-external="clinicaldata"]' );
    };

    // Completely disable preload items
    console.log( 'Preloaders disabled.' );
    require( 'enketo-core/src/js/preload' ).init = function() {};
    // change status message
    $( '<div class="fieldsubmission-status readonly"/>' ).prependTo( '.form-header' )
        .add( $( '<div class="form-footer__feedback fieldsubmission-status readonly"/>' ).prependTo( $footer ) )
        .text( notesEnabled ? t( 'fieldsubmission.noteonly.msg' ) : t( 'fieldsubmission.readonly.msg' ) );

    formParts.form = $( formParts.form );
    // Note: Enketo made a syntax error by adding the readonly attribute on a <select>
    // Hence, we cannot use .prop('readonly', true). We'll continue the syntax error.
    formParts.form.find( 'input, textarea, select:not(#form-languages)' )
        .filter( function() {
            return notesEnabled ? $( this ).parent( '.or-appearance-dn' ).length === 0 : true;
        } )
        .attr( 'readonly', 'readonly' );
    // Properly make native selects readonly (for touchscreens)
    formParts.form.find( 'select:not(#form-languages) option' ).prop( 'disabled', true );
    // Prevent adding an Add/Remove UI on repeats
    formParts.form.find( '.or-repeat-info' ).attr( 'data-repeat-fixed', 'fixed' );
    // Record load warning but keep loading
    if ( settings.loadWarning ) {
        loadWarnings.push( settings.loadWarning );
    }

    return formParts;
}

function _init( formParts ) {
    $formheader.after( formParts.form );
    $( document ).ready( function() {
        translator.localize( document.querySelector( 'form.or' ) );
        controller.init( 'form.or:eq(0)', {
            modelStr: formParts.model,
            instanceStr: formParts.instance,
            external: formParts.externalData,
            instanceAttachments: formParts.instanceAttachments
        }, loadWarnings ).then( function( form ) {
            // Note: be careful, "form" param returned by controller.init is undefined if there were loadErrors (in fs view).
            var $title = $( '#form-title' );
            var title = ( settings.pid ) ? settings.pid + ': ' + $title.text() : $title.text();
            $title.text( title );
            $( 'head>title' ).text( title );
            if ( formParts.instance ) {
                oc.addSignedStatus( form );
            }
        } );
    } );
}
