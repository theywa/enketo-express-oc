// Extend the Enketo Core Form Model, and expose it for local testing.

'use strict';

var Model = require( 'enketo-core/src/js/Form-model' );
var XPathJS = require( 'enketo-xpathjs' );
var $ = require( 'jquery' );

// Add OC custom XPath functions
require( 'enketo-xpath-extensions-oc' )( XPathJS );

Model.prototype.getUpdateEventData = function( el, type ) {
    var fullPath;
    var xmlFragment;
    var file;

    if ( !el ) {
        console.error( new Error( 'XML Node not found. Form probably contains reference to non-existing XML node.' ) );
        return {};
    }
    fullPath = this.getXPath( el, 'instance', true );
    xmlFragment = this.getXmlFragmentStr( el );
    file = ( type === 'binary' ) ? el.textContent : undefined;
    return {
        fullPath: fullPath,
        xmlFragment: xmlFragment,
        file: file
    };
};

Model.prototype.getRemovalEventData = function( el ) {
    var xmlFragment = this.getXmlFragmentStr( el );
    return {
        xmlFragment: xmlFragment
    };
};

Model.prototype.getXmlFragmentStr = function( node ) {
    var clone;
    var n;
    var dataStr;
    var tempAttrName = 'temp-id';
    var id = Math.floor( Math.random() * 100000000 );
    node.setAttribute( tempAttrName, id );
    clone = this.rootElement.cloneNode( true );
    node.removeAttribute( tempAttrName );
    n = clone.querySelector( '[' + tempAttrName + '="' + id + '"]' );
    n.removeAttribute( tempAttrName );

    $( n ).children().remove();

    while ( n !== clone ) {
        $( n ).siblings().remove();
        n = n.parentNode;
    }

    // Remove comment nodes from tiny remaining fragment
    $( clone ).find( '*' ).addBack().contents().filter( function() {
        return this.nodeType === 8;
    } ).remove();

    dataStr = ( new XMLSerializer() ).serializeToString( clone, 'text/xml' );
    // restore default namespaces
    dataStr = dataStr.replace( /\s(data-)(xmlns=("|')[^\s>]+("|'))/g, ' $2' );
    return dataStr;
};

Model.prototype.isMarkedComplete = function() {
    return this.evaluate( '/node()/@oc:complete = "true"', 'boolean', null, null, true );
};

module.exports = Model;
