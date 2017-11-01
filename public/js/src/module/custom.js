'use strict';

// Custom OC things used across views

var $ = require( 'jquery' );
var t = require( 'translator' ).t;

function addSignedStatus( form ) {
    var $status;
    var metaPlus = '/*/' /* + model.getNamespacePrefix( 'http://openrosa.org/xforms' ) + ':'*/ +
        'meta/' + form.model.getNamespacePrefix( 'http://openclinica.org/xforms' ) + ':';
    var signedBy = form.model.evaluate( metaPlus + 'signedBy', 'string' );
    var signedOn = form.model.evaluate( metaPlus + 'signedOn', 'string' );

    if ( signedBy && signedOn ) {
        $status = $( '<div class="record-signed-status">' + t( 'signed.msg', {
                name: signedBy,
                date: signedOn
            } ) +
            '</div>' );
        $( '#form-title' )
            .before( $status )
            .closest( 'form.or' ).on( 'valuechange.enketo inputupdate.enketo', function() {
                $status.remove();
            } );
    }
}


module.exports = {
    addSignedStatus: addSignedStatus
};
