const pluginName = 'discrepancyNote';
import $ from 'jquery';
import Comment from './Dn';

$.fn[ pluginName ] = function( options, event ) {

    options = options || {};

    return this.each( function() {
        const $this = $( this );
        const data = $this.data( pluginName );

        if ( !data && typeof options === 'object' ) {
            $this.data( pluginName, new Comment( this, options, event, pluginName ) );
        } else if ( data && typeof options == 'string' ) {
            data[ options ]( this );
        }
    } );
};

export default {
    'name': pluginName,
    'selector': '.or-appearance-dn input[type="text"][data-for], .or-appearance-dn textarea[data-for]',
    'helpersRequired': [ 'input', 'pathToAbsolute', 'evaluate', 'getModelValue' ]
};
