// Extend the Enketo Core page class by overwriting some functionality
'use strict';

var pageModule = require( 'enketo-core/src/js/page' );
var reasons = require( './reasons' );
var settings = require( './settings' );
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
            event.target.classList.remove( 'current', 'contains-current' );
            event.target.querySelector( '.current' ).classList.remove( 'current' );

            // ---------- Custom OC --------------
            if ( event.target.getAttribute( 'role' ) === 'page' && !reasons.validate() ) {
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
                var $target = $( event.target ).prev();
                if ( $target.length === 0 ) {
                    $target = $( event.target );
                }
                // is it best to go to previous page always?
                that.flipToPageContaining( $target );
            }
        } );
};

var originalPageModuleNext = pageModule._next;

pageModule._next = function() {
    var that = this;
    // the original call takes care of all the validations
    originalPageModuleNext.call( this )
        .then( function( valid ) {
            // for strict-validation navigation-blocking, we ignore some errors (compared to Enketo Core module)
            if ( !valid && settings.strictCheckEnabled ) {
                var selector = '.oc-strict.invalid-required, .oc-strict.invalid-constraint, .oc-strict.invalid-relevant';
                var strictViolations = that.$current[ 0 ].matches( selector ) || !!that.$current[ 0 ].querySelector( selector );

                if ( !strictViolations ) {
                    var currentIndex = that._getCurrentIndex();
                    var next = that._getNext( currentIndex );
                    if ( next ) {
                        var newIndex = currentIndex + 1;
                        that._flipTo( next, newIndex );
                        //return newIndex;
                    }

                    valid = true;
                }
            }
            return valid;
        } );

};
