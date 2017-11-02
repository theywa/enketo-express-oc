// Extend the Enketo Core page class by overwriting some functionality
'use strict';

var pageModule = require( 'enketo-core/src/js/page' );
var reasons = require( './reasons' );
var $ = require( 'jquery' );

/*
 * The only thing we want to change in this function for OC, 
 * is to NOT flip to the next page when a repeat is the same as a page and
 * and a new repeat instance is created,
 * while there are empty reason-for-change fields.
 */
pageModule.setRepeatHandlers = function() {
    var that = this;
    this.form.view.$
        .off( 'addrepeat.pagemode' )
        .on( 'addrepeat.pagemode', function( event, index, byCountUpdate ) {
            that.updateAllActive();
            // Removing the class in effect avoids the animation
            // It also prevents multiple .or-repeat[role="page"] to be shown on the same page
            $( event.target ).removeClass( 'current contains-current' ).find( '.current' ).removeClass( 'current' );

            // ---------- Custom OC --------------
            if ( $( event.target ).attr( 'role' ) === 'page' && !reasons.validate() ) {
                that.toggleButtons();
            }
            // ------- End of Custom OC ----------
            // Don't flip if the user didn't create the repeat with the + button.
            else if ( !byCountUpdate ) {
                that.flipToPageContaining( $( event.target ) );
            }
        } )
        .off( 'removerepeat.pagemode' )
        .on( 'removerepeat.pagemode', function( event ) {
            // if the current page is removed
            // note that that.$current will have length 1 even if it was removed from DOM!
            if ( that.$current.closest( 'html' ).length === 0 ) {
                that.updateAllActive();
                // is it best to go to previous page always?
                that.flipToPageContaining( $( event.target ) );
            }
        } );
};
