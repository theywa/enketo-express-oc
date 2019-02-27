import pageModule from 'enketo-core/src/js/page';
import reasons from './reasons';
import settings from './settings';
import gui from './gui';
import $ from 'jquery';

/*
 * The only thing we want to change in this function for OC, 
 * is to NOT flip to the next page when a repeat is the same as a page and
 * and a new repeat instance is created,
 * while there are empty reason-for-change fields.
 */
pageModule.setRepeatHandlers = function() {
    const that = this;
    this.form.view.$
        .off( 'addrepeat.pagemode' )
        .on( 'addrepeat.pagemode', ( event, index, byCountUpdate ) => {
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
        .on( 'removerepeat.pagemode', event => {
            // if the current page is removed
            // note that that.$current will have length 1 even if it was removed from DOM!
            if ( that.$current.closest( 'html' ).length === 0 ) {
                that.updateAllActive();
                let $target = $( event.target ).prev();
                if ( $target.length === 0 ) {
                    $target = $( event.target );
                }
                // is it best to go to previous page always?
                that.flipToPageContaining( $target );
            }
        } );
};

const originalPageModuleNext = pageModule._next;

pageModule._next = function() {
    const that = this;
    // the original call takes care of all the validations
    originalPageModuleNext.call( this )
        .then( valid => {
            // for strict-validation navigation-blocking, we ignore some errors (compared to Enketo Core module)
            if ( !valid && settings.strictViolationSelector ) {

                const strictViolations = that.$current[ 0 ].matches( settings.strictViolationSelector ) || !!that.$current[ 0 ].querySelector( settings.strictViolationSelector );

                if ( !strictViolations ) {
                    const currentIndex = that._getCurrentIndex();
                    const next = that._getNext( currentIndex );
                    if ( next ) {
                        const newIndex = currentIndex + 1;
                        that._flipTo( next, newIndex );
                        //return newIndex;
                    }

                    valid = true;
                } else {
                    gui.alertStrictBlock();
                }
            }
            return valid;
        } );

};
