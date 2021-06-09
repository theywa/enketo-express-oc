import Widget from 'enketo-core/src/js/widget';
import events from 'enketo-core/src/js/event';

/**
 * Auto-resizes textarea elements.
 *
 * @augments Widget
 */
class TextareaWidget extends Widget {
    /**
     * @type {string}
     */
    static get selector() {
        return 'form';
    }

    _init() {
        const textareas = this.element.querySelectorAll( 'textarea' );
        this.defaultHeight = textareas[ 0 ] ? textareas[ 0 ].clientHeight : 20;
        this.element.addEventListener( 'input', event => {
            const el = event.target;
            if ( el.nodeName.toLowerCase() === 'textarea' ) {
                this._resize( el );
            }
        } );
        this.element.addEventListener( events.PageFlip().type, event => {
            const els = event.target.querySelectorAll( 'textarea' );
            els.forEach( this._resize.bind( this ) );
        } );

        // https://github.com/OpenClinica/enketo-express-oc/issues/484
        const textareaWidget = this;
        setTimeout(function() {
            textareas.forEach( textareaWidget._resize.bind( textareaWidget ) );    
        }, 100);
    }

    _resize( el ) {
        if ( el.scrollHeight > el.clientHeight && el.scrollHeight > this.defaultHeight ) {
            // using height instead of min-height to allow user to resize smaller manually
            el.style[ 'height' ] = `${el.scrollHeight}px`;
            // for the Grid theme:
            el.style[ 'flex' ] = 'auto';
        }
    }
}

export default TextareaWidget;
