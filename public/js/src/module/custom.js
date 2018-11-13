// Custom OC things used across views

import $ from 'jquery';

function addSignedStatus( form ) {
    let $status;
    const metaPlus = `/*/meta/${form.model.getNamespacePrefix( 'http://openclinica.org/xforms' )}:` /* + model.getNamespacePrefix( 'http://openrosa.org/xforms' ) + ':'*/ ;
    const signature = form.model.evaluate( `${metaPlus}signature`, 'string' );
    if ( signature ) {
        $status = $( `<div class="record-signed-status">${signature.replace( /\\n/g, '<br/>' ).replace( /\n/g, '<br/>' )}</div>` );
        $( '#form-title' )
            .before( $status )
            .closest( 'form.or' ).one( 'valuechange.enketo', '.question:not(.or-appearance-dn)', () => {
                $status.remove();
            } );
    }
}


export default {
    addSignedStatus
};
