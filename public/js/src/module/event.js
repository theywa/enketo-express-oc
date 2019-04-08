import events from 'enketo-core/src/js/event';

events.ReasonChange = function( detail ) {
    return new CustomEvent( 'reasonchange', { detail } );
};

events.Heartbeat = function() {
    return new CustomEvent( 'heartbeat' );
};

events.QueueSubmissionSuccess = function( detail ) {
    return new CustomEvent( 'queuesubmissionsuccess', { detail, bubbles: true } );
};

events.SubmissionSuccess = function() {
    return new CustomEvent( 'submissionsuccess', { bubbles: true } );
};

events.Close = function() {
    return new CustomEvent( 'close', { bubbles: true } );
};

export default events;
