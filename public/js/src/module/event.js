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

events.AddQuery = function() {
    return new CustomEvent( 'addquery', { bubbles: true } );
};

events.FakeInputUpdate = function() {
    return new CustomEvent( 'fakeinputupdate', { bubbles: true } );
};

events.OfflineLaunchCapable = function( detail ) {
    return new CustomEvent( 'offlinelaunchcapable', { detail, bubbles: true } );
};

events.ApplicationUpdated = function() {
    return new CustomEvent( 'applicationupdated', { bubbles: true } );
};

events.FormUpdated = function() {
    return new CustomEvent( 'formupdated', { bubbles: true } );
};

events.FormReset = function() {
    return new CustomEvent( 'formreset', { bubbles: true } );
};

export default events;
