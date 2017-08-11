// Modify the Enketo Core branch module.

'use strict';

var branchModule = require( 'enketo-core/src/js/branch' );
var $ = require( 'jquery' );

/**
 * Overwrite core functionality by **always** adding 
 * .or-group.invalid-relevant and .or-group-data.invalid-relevant.
 */
branchModule.update = function( updated, forceClearIrrelevant ) {
    var $nodes;

    if ( !this.form ) {
        throw new Error( 'Branch module not correctly instantiated with form property.' );
    }

    $nodes = this.form.getRelatedNodes( 'data-relevant', '', updated )
        // the OC customization:
        .add( this.form.getRelatedNodes( 'data-relevant', '.invalid-relevant' ) );

    this.updateNodes( $nodes, forceClearIrrelevant );
};


/**
 * Overwrite core functionality by removing isSelfRelevant check
 */
branchModule.enable = function( $branchNode ) {
    $branchNode.removeClass( 'disabled pre-init' );
    this.form.widgets.enable( $branchNode );
    this.activate( $branchNode );
    return true;
};


/**
 * Overwrite clear function
 */
branchModule.clear = function() {
    // Only user can clear values in OC.
};

branchModule.activate = function( $branchNode ) {
    var $control;
    var required;

    this.setDisabledProperty( $branchNode, false );
    if ( $branchNode.is( '.question' ) ) {
        $control = $( $branchNode[ 0 ].querySelector( 'input, select, textarea' ) );
        this.form.setValid( $control, 'relevant' );
        // Re-show any constraint error message when the relevant error has been removed.
        // Since validateInput looks at both required and constraint, and we don't want required
        // validation, we use a very dirty trick to bypass it.
        required = $control.data( 'required' );
        if ( required ) {
            $control.removeAttr( 'data-required' );
        }
        this.form.validateInput( $control );
        if ( required ) {
            $control.attr( 'data-required', required );
        }
    } else if ( $branchNode.is( '.or-group, .or-group-data' ) ) {
        this.form.setValid( $branchNode, 'relevant' );
    }
};

branchModule.originalDeactivate = branchModule.deactivate;

// Overwrite deactivate function
branchModule.deactivate = function( $branchNode ) {
    var name;
    var index = 0;
    var value;
    var $control;
    var that = this;

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

    } else if ( $branchNode.is( '.or-group, .or-group-data' ) ) {
        name = this.form.input.getName( $branchNode );
        index = this.form.input.getIndex( $branchNode );
        /*
         * We need to check if any of the _regular_ fields with a form control 
         * (ie. excl calculations and discrepancy note questions) has a value.
         * The best way is to do this in the model.
         * 
         * First get all the leafnodes (nodes without children) and then check if there is a calculation 
         * or dn question for this node.
         * 
         * Then get the concatenated textContent of the filtered leafnodes and trim to avoid 
         * recognizing whitespace-only as a value. (whitespace in between is fine as it won't give a false positive)
         * 
         * If the result has length > 0, one form control in the group has a value.
         */
        value = this.form.model.node( name, index ).get().find( '*' ).filter( function() {
            if ( $( this ).children().length === 0 ) {
                var path = that.form.model.getXPath( this, 'instance' );
                var $n = that.form.view.$.find( '.calculation > [name="' + path + '"], .or-appearance-dn > [name="' + path + '"]' );
                return $n.length === 0;
            }
            return false;
        } ).text().trim();

        if ( value.length ) {
            this.form.setInvalid( $branchNode, 'relevant' );
        } else {
            this.form.setValid( $branchNode, 'relevant' );
            this.originalDeactivate( $branchNode );
            $branchNode.trigger( 'hiding.oc' );
        }
    }
};
