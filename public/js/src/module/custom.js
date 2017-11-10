'use strict';

// Custom OC things used across views

var $ = require( 'jquery' );

function addSignedStatus( form ) {
    var $status;
    var metaPlus = '/*/' /* + model.getNamespacePrefix( 'http://openrosa.org/xforms' ) + ':'*/ +
        'meta/' + form.model.getNamespacePrefix( 'http://openclinica.org/xforms' ) + ':';
    var signature = form.model.evaluate( metaPlus + 'signature', 'string' );
    if ( signature ) {
        $status = $( '<div class="record-signed-status">' +
            signature.replace( /\\n/g, '<br/>' ).replace( /\n/g, '<br/>' ) + '</div>' );
        $( '#form-title' )
            .before( $status )
            .closest( 'form.or' ).one( 'valuechange.enketo', '.question:not(.or-appearance-dn)', function() {
                $status.remove();
            } );
    }
}


module.exports = {
    addSignedStatus: addSignedStatus
};
