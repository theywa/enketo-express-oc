// Modify the Enketo Core branch module.

'use strict';

var branchModule = require( 'enketo-core/src/js/relevant' );
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

branchModule.originalSelfRelevant = branchModule.selfRelevant;

// Overwrite in order to add the && !branchNode.classList.contains('invalid-relevant') clause because an irrelevant branch in OC, 
// would not be disabled if it is a question with a value!
branchModule.selfRelevant = function( $branchNode ) {
    return this.originalSelfRelevant( $branchNode ) && !$branchNode.hasClass( 'invalid-relevant' );
};

branchModule.originalEnable = branchModule.enable;

/**
 * Overwrite core functionality.
 * The reason for this customization is to remove any shown irrelevant errors on the group (and perhaps question as well?)
 * once it becomes relevant again.
 */
branchModule.enable = function( $branchNode, path ) {
    const change = this.originalEnable( $branchNode, path );
    $branchNode.removeClass( 'invalid-relevant' );
    return change;
};

/*
 * Overwrite to bypass the overwritten isRelevantCheck.
 * No need for functionality to clear values in irrelevant fields either.
 */
branchModule.disable = function( $branchNode, path, forceClearIrrelevant ) {
    const virgin = $branchNode.hasClass( 'pre-init' );
    let change = false;

    if ( virgin || !$branchNode.hasClass( 'disabled' ) ) {
        change = true;
        // if the branch was previously enabled, keep any default values
        if ( !virgin ) {
            if ( this.form.options.clearIrrelevantImmediately || forceClearIrrelevant ) {
                this.clear( $branchNode, path );
            }
        } else {
            $branchNode.removeClass( 'pre-init' );
        }

        this.deactivate( $branchNode );
    }
    return change;
};

/**
 * Overwrite clear function
 */
branchModule.clear = function( $branchNode, path ) {
    // Only user can clear values from user-input fields in OC.
    // TODO: when readonly becomes dynamic, we'll have to fix this.
    // Only for readonly items in OC fork:
    $branchNode
        .find( 'input[readonly]:not(.ignore), select[readonly]:not(.ignore), textarea[readonly]:not(.ignore)' )
        .closest( '.question' )
        .clearInputs( 'change', 'inputupdate.enketo' );

    // Unchanged from Enketo Core:
    if ( $branchNode.is( '.or-group, .or-group-data' ) ) {
        this.form.calc.update( {
            relevantPath: path
        } );
    }
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
        value = this.form.model.node( name, index ).getVal();

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
        /*
         * We need to check if any of the fields with a form control or calculations
         * (ie. excl discrepancy note questions) has a value.
         * The best way is to do this in the model.
         * Note that we need to check ALL repeats if the repeat parent (with the same /path/to/repeat) has a relevant!
         * 
         * First get all the leaf nodes (nodes without children) and then check if there is a calculation 
         * or dn question for this node.
         * 
         * Then get the concatenated textContent of the filtered leaf nodes and trim to avoid 
         * recognizing whitespace-only as a value. (whitespace in between is fine as it won't give a false positive)
         * 
         * If the result has length > 0, one form control in the group has a value.
         */
        var dataEls = this.form.model.node( name ).getElements();

        if ( !dataEls.length ) {
            value = false;
        } else {
            value = dataEls.some( function( dataEl ) {
                return Array.prototype.slice.call( dataEl.querySelectorAll( '*' ) )
                    .filter( function( el ) {
                        if ( el.children.length === 0 ) {
                            var path = that.form.model.getXPath( el, 'instance' );
                            var n = that.form.view.html.querySelector( '.calculation > [name="' + path + '"], .or-appearance-dn > [name="' + path + '"]' );
                            return !n;
                        }
                        return false;
                    } )
                    .map( function( el ) {
                        return el.textContent ? el.textContent.trim() : '';
                    } )
                    .join( '' );
            } );
        }

        if ( value ) {
            this.form.setInvalid( $branchNode, 'relevant' );
        } else {
            this.form.setValid( $branchNode, 'relevant' );
            this.originalDeactivate( $branchNode );
            // trigger on all questions inside this group that possibly have a discrepancy note attached to them.
            $branchNode.find( '.question' ).trigger( 'hiding.oc' );
        }
    }
};
