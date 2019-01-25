import Widget from 'enketo-core/src/js/widget';
import settings from '../../public/js/src/module/settings';

class StrictClass extends Widget {

    static get selector() {
        return 'form';
    }

    static condition() {
        return !!settings.strictCheckEnabled;
    }

    _init() {
        const elements = Array.prototype.slice.call( this.element.querySelectorAll( '[oc-required-type="strict"], [oc-constraint-type="strict"]' ) )
            .map( el => el.closest( '.question' ) )
            .concat( Array.prototype.slice.call( this.element.querySelectorAll( '.or-branch' ) )
                .map( el => el.closest( '.question, .or-group, .or-group-data' ) )
                // If branch is calculation without form control, exclude it;
                .filter( el => !!el )
            );

        elements.forEach( el => {
            el.classList.add( 'oc-strict' );
        } );
    }
}

export default StrictClass;
