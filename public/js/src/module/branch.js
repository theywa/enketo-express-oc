// Modify the Enketo Core branch module.

'use strict';

var branchModule = require( 'enketo-core/src/js/branch' );
var $ = require( 'jquery' );

/**
 * Overwrite core functionality by removing isSelfRelevant check
 */
branchModule.enable = function( $branchNode ) {
    $branchNode.removeClass( 'disabled pre-init' );
    this.form.widgets.enable( $branchNode );
    this.activate( $branchNode );
    return true;
};


// Overwrite clear function
branchModule.clear = function( $branchNode ) {
    // Only user can clear values in OC.
};

branchModule.activate = function( $branchNode ) {
    var $control;

    this.setDisabledProperty( $branchNode, false );
    if ( $branchNode.is( '.question' ) ) {
        $control = $( $branchNode[ 0 ].querySelector( 'input, select, textarea' ) );
        this.form.setValid( $control, 'relevant' );
    }
};

branchModule.originalDeactivate = branchModule.deactivate;

// Overwrite deactivate function
branchModule.deactivate = function( $branchNode ) {
    var name;
    var index = 0;
    var value;
    var $control;

    if ( $branchNode.is( '.question' ) ) {
        $control = $( $branchNode[ 0 ].querySelector( 'input, select, textarea' ) );

        name = this.form.input.getName( $control );
        index = this.form.input.getIndex( $control );
        value = this.form.model.node( name, index ).getVal()[ 0 ];

        if ( value !== '' ) {
            //$branchNode.removeClass( 'disabled' );
            this.form.setInvalid( $control, 'relevant' );
            // After setting invalid-relevant remove any previous errors.
            this.form.setValid( $control, 'constraint' );
            this.form.setValid( $control, 'required' );
        } else {
            this.form.setValid( $control, 'relevant' );
            this.originalDeactivate( $branchNode );
            $branchNode.trigger( 'hiding.oc' );
        }

    } else {
        //TODO: if group descendent has a value, add the relevantError class and remove other errors
        this.originalDeactivate( $branchNode );
        $branchNode.trigger( 'hiding.oc' );
    }
};
