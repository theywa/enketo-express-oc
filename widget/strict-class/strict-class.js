import Widget from 'enketo-core/src/js/Widget';
import $ from 'jquery';
import settings from '../../public/js/src/module/settings';

// It is very helpful to make this the same as widget class, except for converting the first character to lowercase.
const pluginName = 'strictClass';

/**
 * [My Fancy Widget description]
 *
 * @constructor
 * @param {Element}                       element   Element to apply widget to.
 * @param {{}|{helpers: *}}                             options   options
 * @param {*=}                            event     event
 */
function StrictClass( element, options ) {
    // set the namespace (important!)
    this.namespace = pluginName;
    // call the Super constructor
    Widget.call( this, element, options );
    this._init();
}

// copy the prototype functions from the Widget super class
StrictClass.prototype = Object.create( Widget.prototype );

// ensure the constructor is the new one
StrictClass.prototype.constructor = StrictClass;

// add your widget functions
StrictClass.prototype._init = function() {
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
};

/**
 * override the super's disable method if necessary
 */
// StrictClass.prototype.disable = function() { };

/**
 * override the super's enable method if necessary
 */
// StrictClass.prototype.enable = function() { };

/**
 * override the super's update method if necessary
 */
// StrictClass.prototype.update = function() { };


$.fn[ pluginName ] = function( options, event ) {

    options = options || {};

    return this.each( function() {

        if ( settings.strictCheckEnabled ) {
            const $this = $( this );
            const data = $this.data( pluginName );

            // only instantiate if options is an object (i.e. not a string) and if it doesn't exist already
            if ( !data && typeof options === 'object' ) {
                $this.data( pluginName, new StrictClass( this, options, event ) );
            }
            // only call method if widget was instantiated before
            else if ( data && typeof options == 'string' ) {
                // pass the element as a parameter
                data[ options ]( this );
            }
        }
    } );
};

// returns its own properties so we can use this to instantiate the widget
export default {
    'name': pluginName,
    'selector': 'form',
};
