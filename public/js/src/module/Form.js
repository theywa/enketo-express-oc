// Extend the Enketo Core Form class, and expose it for local testing.

'use strict';

var Form = require( 'enketo-core/src/js/Form' );
var $ = require( 'jquery' );

require( './Form-model' );
require( './branch' );

/**
 * This function doesn't actually evaluate constraints. It triggers
 * an event on nodes that have constraint dependency on the changed node(s).
 * This event is used in the discrepancy notes widget.
 * 
 * @param  {[type]} updated [description]
 */
var constraintUpdate = function( updated ) {
    var $nodes;
    updated = updated || {};
    // If the update object is a repeat node (cloned=true), do nothing
    if ( !updated.cloned ) {
        $nodes = this.getRelatedNodes( 'data-constraint', '', updated )
            // The filter below is commented out, because at the moment this.getRelatedNodes already takes
            // care of this (in enketo-core). However, it is not unrealistic to expect that in the future we will 
            // not be able to rely on that as it may be considered a performance hack too far. In that case, uncomment below.
            // 
            // Filter out the nodes that are inside a repeat instance other than
            // the repeat instance that contains the node that triggered the dataupdate
            // https://github.com/kobotoolbox/enketo-express/issues/741
            /*.filter( function() {
                var $input;
                var $repeat;
                var repeatIndex;
                if ( !updated.repeatPath ) {
                    return true;
                }
                $input = $( this );
                $repeat = $input.closest( '.or-repeat[name="' + updated.repeatPath + '"]' );
                if ( !$repeat.length ) {
                    return true;
                }
                repeatIndex = $( '.or-repeat[name="' + updated.repeatPath + '"]' ).index( $repeat );
                return repeatIndex === updated.repeatIndex;
            } )*/
            .trigger( 'constraintevaluated.oc', updated );
    }
};

/**
 * OC does not empty irrelevant nodes. Instead non-empty irrelevant nodes get an error until the user clears the value.
 * This function takes care of re-evaluating the branch when the value is cleared.
 *
 * @param  {[type]} updated [description]
 * @return {[type]}         [description]
 */
var relevantErrorUpdate = function( updated ) {
    var $nodes;
    var that = this;
    //updated = updated || {};

    $nodes = this.getRelatedNodes( 'name', '[data-relevant]', updated )
        .closest( '.invalid-relevant' )
        .map( function() {
            return $( this ).is( '[data-relevant]' ) ? this : this.querySelector( '[data-relevant]' );
        } );

    this.branch.updateNodes( $nodes );

};

var originalInit = Form.prototype.init;

Form.prototype.evaluationCascadeAdditions = [ constraintUpdate, relevantErrorUpdate ];

/**
 * Overrides function in Enketo Core to hide asterisk if field has value.
 * 
 * @param  {[type]} n [description]
 */
Form.prototype.updateRequiredVisibility = function( n ) {
    var node;
    if ( n.required ) {
        node = this.model.node( n.path, n.ind );
        n.$required.toggleClass( 'hide', node.getVal().toString() !== '' || !node.isRequired( n.required ) );
    }
};


Form.prototype.init = function() {
    var $nodes;
    var that = this;
    var loadErrors = originalInit.call( this );
    // Add custom functionality
    try {
        // Evaluate "required" expressions upon load to hide asterisks.
        // Evaluate "constraint" expressions upon load to show error message for fields that *have a value*.
        this.getRelatedNodes( 'data-required' ).add( $( this.getRelatedNodes( 'data-constraint' ) ) ).each( function() {
            var $input = $( this );
            that.validateInput( $input )
                .then( function( passed ) {
                    if ( !passed ) {
                        // Undo the displaying of a required error message upon load
                        that.setValid( $input, 'required' );
                    }
                } );
        } );
    } catch ( e ) {
        console.error( e );
        loadErrors.push( e.name + ': ' + e.message );
    }
    return loadErrors;
};

module.exports = Form;
