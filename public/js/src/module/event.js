// Modify the Enketo Core event.
import events from 'enketo-core/src/js/event';

events.ReasonChange = function( detail ) {
    return new CustomEvent( 'reasonchange', { detail } );
};

export default events;
