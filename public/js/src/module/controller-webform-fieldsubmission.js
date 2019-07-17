/**
 * Deals with the main high level survey controls for the special online-only auto-fieldsubmission view.
 *
 * Field values are automatically submitted upon change to a special OpenClinica Field Submission API.
 */

import gui from './gui';

import settings from './settings';
import Form from './Form'; // modified for OC
import fileManager from './file-manager';
import events from './event';
import { t } from './translator';
import $ from 'jquery';
import FieldSubmissionQueue from './field-submission-queue';
let fieldSubmissionQueue;
import rc from './controller-webform';
import reasons from './reasons';
const DEFAULT_THANKS_URL = '/thanks';
let form;
let formSelector;
let formprogress;
let ignoreBeforeUnload = false;
let clearedForSubmissions = false;

const formOptions = {
    printRelevantOnly: settings.printRelevantOnly
};


function init( selector, data, loadWarnings = [] ) {
    let advice;
    let loadErrors = [];

    formSelector = selector;
    formprogress = document.querySelector( '.form-progress' );

    return new Promise( resolve => {
            const goToErrorLink = settings.goToErrorUrl ? `<a href="${settings.goToErrorUrl}">${settings.goToErrorUrl}</a>` : '';

            if ( data.instanceAttachments ) {
                fileManager.setInstanceAttachments( data.instanceAttachments );
            }

            form = new Form( formSelector, data, formOptions );

            // Additional layer of security to disable submissions in readonly views.
            // Should not be necessary to do this.
            if ( settings.type !== 'view' ) {
                fieldSubmissionQueue = new FieldSubmissionQueue();
            } else {
                console.log( 'Fieldsubmissions disabled' );
                fieldSubmissionQueue = {
                    submitAll() { return Promise.resolve(); },
                    get() { return {}; }
                };
            }

            // For Participant emtpy-form view in order to show Close button on all pages
            if ( settings.strictViolationSelector && settings.type !== 'edit' ) {
                form.view.html.classList.add( 'empty-untouched' );
            }
            // For all Participant views, use a hacky solution to change the default relevant message
            if ( settings.strictViolationSelector ) {
                const list = form.view.html.querySelectorAll( '[data-i18n="constraint.relevant"]' );
                for ( let i = 0; i < list.length; i++ ) {
                    const relevantErrorMsg = t( 'constraint.relevant' );
                    list[ i ].textContent = relevantErrorMsg;
                }
            }

            // set form eventhandlers before initializing form
            _setFormEventHandlers();

            const handleGoToHidden = e => {
                let err;
                // In OC hidden go_to fields should show loadError 
                // regular questions:
                if ( !e.target.classList.contains( 'or-appearance-dn' ) ) {
                    err = t( 'alert.goto.hidden' );
                }
                // Discrepancy notes
                else {
                    err = `${t( 'alert.goto.hidden' )} `;
                    const goToErrorLink = settings.goToErrorUrl ? `<a href="${settings.goToErrorUrl}">${settings.goToErrorUrl}</a>` : '';
                    err += goToErrorLink ? t( 'alert.goto.msg2', {
                        miniform: goToErrorLink,
                        // switch off escaping
                        interpolation: {
                            escapeValue: false
                        }
                    } ) : t( 'alert.goto.msg1' );
                }
                // For goto targets that are discrepancy notes and are relevant but their linked question is not,
                // the gotohidden event will be fired twice. We can safely remove the eventlistener after the first
                // event is caught (for all cases).
                form.view.html.removeEventListener( events.GoToHidden().type, handleGoToHidden );
                loadWarnings.push( err );
            };


            // listen for "gotohidden" event and add error
            form.view.html.addEventListener( events.GoToHidden().type, handleGoToHidden );

            loadErrors = loadErrors.concat( form.init() );

            // Check if record is marked complete, before setting button event handlers.
            if ( data.instanceStr ) {
                // DEBUG
                // console.log( 'record to load:', data.instanceStr );
                if ( form.model.isMarkedComplete() ) {
                    const finishButton = document.querySelector( 'button#finish-form' );
                    const regCloseButton = document.querySelector( 'button#close-form-regular' );
                    if ( finishButton ) {
                        finishButton.remove();
                    }
                    if ( regCloseButton ) {
                        regCloseButton.id = 'close-form-complete';
                    }
                } else if ( settings.reasonForChange ) {
                    loadErrors.push( 'This record is not complete and cannot be used here.' );
                    document.querySelector( 'button#close-form-regular' ).remove();
                }
                if ( !settings.headless ) {
                    form.specialOcLoadValidate( form.model.isMarkedComplete() );
                }
            }

            _setButtonEventHandlers();

            // Remove loader. This will make the form visible.
            // In order to aggregate regular loadErrors and GoTo loaderrors,
            // this is placed in between form.init() and form.goTo().
            $( '.main-loader' ).remove();

            if ( settings.goTo && location.hash ) {
                // form.goTo returns an array of 1 error if it has error. We're using our special
                // knowledge of Enketo Core to replace this error
                let goToErrors = form.goTo( decodeURIComponent( location.hash.substring( 1 ) ).split( '#' )[ 0 ] );
                if ( goToErrors.length ) {
                    const replErr = `${t( 'alert.goto.notfound' )} `;
                    goToErrors = goToErrorLink ? [ replErr + t( 'alert.goto.msg2', {
                        miniform: goToErrorLink,
                        // switch off escaping
                        interpolation: {
                            escapeValue: false
                        }
                    } ) ] : [ replErr + t( 'alert.goto.msg1' ) ];
                }
                loadWarnings = loadWarnings.concat( goToErrors );
            }

            if ( form.encryptionKey ) {
                loadErrors.unshift( `<strong>${t( 'error.encryptionnotsupported' )}</strong>` );
            }

            rc.setLogoutLinkVisibility();

            if ( loadErrors.length > 0 ) {
                document.querySelectorAll( '.form-footer__content__main-controls button' )
                    .forEach( button => button.remove() );
            }

            const loadIssues = loadWarnings.concat( loadErrors );

            if ( loadIssues.length ) {
                throw loadIssues;
            }

            clearedForSubmissions = true;
            resolve( form );
        } )
        .catch( error => {
            if ( Array.isArray( error ) ) {
                loadErrors = error;
            } else {
                loadErrors.unshift( error.message || t( 'error.unknown' ) );
            }

            advice = ( data.instanceStr ) ? t( 'alert.loaderror.editadvice' ) : t( 'alert.loaderror.entryadvice' );
            gui.alertLoadErrors( loadErrors, advice );
        } )
        .then( () => {
            if ( settings.headless ) {
                console.log( 'doing headless things' );
                const $result = $( '<div id="headless-result" style="position: fixed; background: pink; top: 0; left: 50%;"/>' );
                if ( loadErrors.length ) {
                    $result.append( `<span id="error">${loadErrors[ 0 ]}</span>` );
                    $( 'body' ).append( $result );
                }
                return _headlessCloseComplete()
                    .then( fieldsubmissions => {
                        $result.append( `<span id="fieldsubmissions">${fieldsubmissions}</span>` );
                    } )
                    .catch( error => {
                        $result.append( `<span id="error">${error.message}</span>` );
                    } )
                    .then( () => {
                        $( 'body' ).append( $result );
                    } );
            }
        } )
        // OC will return even if there were errors
        .then( () => form );
}

function _headlessValidateAndAutoQuery( valid ) {
    const markedAsComplete = form.model.isMarkedComplete();
    let invalid;

    if ( !valid ) {
        if ( markedAsComplete ) {
            invalid = form.view.html.querySelectorAll( '.quesetion.invalid-relevant, .invalid-constraint, .invalid-required' );
        } else {
            invalid = form.view.html.querySelectorAll( '.invalid-relevant, .invalid-constraint' );
        }
        // Trigger auto-queries for relevant, constraint and required (handled in DN widget)
        _autoAddQueries( invalid );
        // Not efficient but robust, and not relying on validateContinuously: true, we just validate again.
        return form.validate();
    }
    return valid;
}

function _headlessCloseComplete() {
    const markedAsComplete = form.model.isMarkedComplete();
    return form.validate()
        // We run the autoquery-and-validate logic 3 times for those forms that have validation logic
        // that is affected by autoqueries, ie. an autoquery for question A makes question B invalid.
        .then( _headlessValidateAndAutoQuery )
        .then( _headlessValidateAndAutoQuery )
        .then( _headlessValidateAndAutoQuery )
        .then( valid => {
            if ( !valid && markedAsComplete ) {
                return valid;
            }
            // ignore .invalid-required
            return form.view.$.find( '.invalid-relevant, .invalid-constraint' ).length === 0;
        } )
        .then( valid => {
            if ( !valid || reasons.getInvalidFields().length ) {
                throw new Error( 'Could not create valid record using autoqueries' );
            }
            return fieldSubmissionQueue.submitAll();
        } )
        .then( () => {
            if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                throw new Error( 'Failed to submit fieldsubmissions' );
            }
            if ( markedAsComplete ) {
                return fieldSubmissionQueue.complete( form.instanceID, form.deprecatedID );
            }
        } )
        .then( () => fieldSubmissionQueue.submittedCounter );
}


/**
 * Closes the form after checking that the queue is empty.
 * 
 * @return {Promise} [description]
 */
function _closeRegular( offerAutoqueries = true ) {
    return form.validate()
        .then( () => {
            let msg = '';
            const tAlertCloseMsg = t( 'fieldsubmission.alert.close.msg1' );
            const tAlertCloseHeading = t( 'fieldsubmission.alert.close.heading1' );
            const authLink = `<a href="/login" target="_blank">${t( 'here' )}</a>`;

            if ( offerAutoqueries ) {
                const violated = [ ...form.view.html.querySelectorAll( '.invalid-constraint, .invalid-relevant' ) ]
                    .filter( question => !question.querySelector( '.btn-comment.new, .btn-comment.updated' ) || question.matches( '.or-group.invalid-relevant, .or-group-data.invalid-relevant' ) );

                // First check if any constraints have been violated and prompt option to generate automatic queries
                if ( violated.length ) {
                    return gui.confirm( {
                            heading: t( 'alert.default.heading' ),
                            errorMsg: t( 'fieldsubmission.confirm.autoquery.msg1' ),
                            msg: t( 'fieldsubmission.confirm.autoquery.msg2' )
                        }, {
                            posButton: t( 'fieldsubmission.confirm.autoquery.automatic' ),
                            negButton: t( 'fieldsubmission.confirm.autoquery.manual' ),
                        } )
                        .then( confirmed => {
                            if ( !confirmed ) {
                                return false;
                            }
                            _autoAddQueries( violated );
                            return _closeRegular( false );
                        } );
                }
            }

            // Start with actually closing, but only proceed once the queue is emptied.
            gui.alert( `${tAlertCloseMsg}<br/><div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>`, tAlertCloseHeading, 'bare' );

            return fieldSubmissionQueue.submitAll()
                .then( () => {
                    if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                        throw new Error( t( 'fieldsubmission.alert.close.msg2' ) );
                    } else {
                        // this event is used in communicating back to iframe parent window
                        document.dispatchEvent( events.Close() );

                        msg += t( 'alert.submissionsuccess.redirectmsg' );
                        gui.alert( msg, t( 'alert.submissionsuccess.heading' ), 'success' );
                        _redirect();
                    }
                } )
                .catch( error => {
                    let errorMsg;
                    error = error || {};

                    console.error( 'close error', error );
                    if ( error.status === 401 ) {
                        errorMsg = t( 'alert.submissionerror.authrequiredmsg', {
                            here: authLink
                        } );
                        gui.alert( errorMsg, t( 'alert.submissionerror.heading' ) );
                    } else {
                        errorMsg = error.message || gui.getErrorResponseMsg( error.status );
                        gui.confirm( {
                                heading: t( 'alert.default.heading' ),
                                errorMsg,
                                msg: t( 'fieldsubmission.confirm.leaveanyway.msg' )
                            }, {
                                posButton: t( 'confirm.default.negButton' ),
                                negButton: t( 'fieldsubmission.confirm.leaveanyway.button' )
                            } )
                            .then( confirmed => {
                                if ( !confirmed ) {
                                    document.dispatchEvent( events.Close() );
                                    _redirect( 100 );
                                }
                            } );
                    }

                } );
        } );


}

function _closeSimple() {

    return form.validate()
        .then( () => {
            let msg = '';
            const tAlertCloseMsg = t( 'fieldsubmission.alert.close.msg1' );
            const tAlertCloseHeading = t( 'fieldsubmission.alert.close.heading1' );
            const authLink = `<a href="/login" target="_blank">${t( 'here' )}</a>`;

            // Start with actually closing, but only proceed once the queue is emptied.
            gui.alert( `${tAlertCloseMsg}<br/><div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>`, tAlertCloseHeading, 'bare' );

            return fieldSubmissionQueue.submitAll()
                .then( () => {
                    if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                        throw new Error( t( 'fieldsubmission.alert.close.msg2' ) );
                    } else {
                        // this event is used in communicating back to iframe parent window
                        document.dispatchEvent( events.Close() );

                        msg += t( 'alert.submissionsuccess.redirectmsg' );
                        gui.alert( msg, t( 'alert.submissionsuccess.heading' ), 'success' );
                        _redirect();
                    }
                } )
                .catch( error => {
                    let errorMsg;
                    error = error || {};

                    if ( error.status === 401 ) {
                        errorMsg = t( 'alert.submissionerror.authrequiredmsg', {
                            here: authLink
                        } );
                        gui.alert( errorMsg, t( 'alert.submissionerror.heading' ) );
                    } else {
                        errorMsg = error.message || gui.getErrorResponseMsg( error.status );
                        gui.confirm( {
                                heading: t( 'alert.default.heading' ),
                                errorMsg,
                                msg: t( 'fieldsubmission.confirm.leaveanyway.msg' )
                            }, {
                                posButton: t( 'confirm.default.negButton' ),
                                negButton: t( 'fieldsubmission.confirm.leaveanyway.button' )
                            } )
                            .then( confirmed => {
                                if ( !confirmed ) {
                                    document.dispatchEvent( events.Close() );
                                    _redirect( 100 );
                                }
                            } );
                    }
                } );
        } );

}

// This is conceptually a Complete function that has some pre-processing.
function _closeCompletedRecord( offerAutoqueries = true ) {

    if ( !reasons.validate() ) {
        const firstInvalidInput = reasons.getFirstInvalidField();
        gui.alert( t( 'fieldsubmission.alert.reasonforchangevalidationerror.msg' ) );
        firstInvalidInput.scrollIntoView();
        firstInvalidInput.focus();
        return Promise.resolve( false );
    } else {
        reasons.clearAll();
    }

    return form.validate()
        .then( valid => {
            if ( !valid && offerAutoqueries ) {
                const violations = [ ...form.view.html.querySelectorAll( '.invalid-constraint, .invalid-required, .invalid-relevant' ) ]
                    .filter( question => !question.querySelector( '.btn-comment.new, .btn-comment.updated' ) || question.matches( '.or-group.invalid-relevant, .or-group-data.invalid-relevant' ) );

                // Note that unlike _close this also looks at .invalid-required.
                if ( violations.length ) {
                    return gui.confirm( {
                            heading: t( 'alert.default.heading' ),
                            errorMsg: t( 'fieldsubmission.confirm.autoquery.msg1' ),
                            msg: t( 'fieldsubmission.confirm.autoquery.msg2' )
                        }, {
                            posButton: t( 'fieldsubmission.confirm.autoquery.automatic' ),
                            negButton: t( 'fieldsubmission.confirm.autoquery.manual' )
                        } )
                        .then( confirmed => {
                            if ( !confirmed ) {
                                return false;
                            }
                            _autoAddQueries( violations );
                            return _closeCompletedRecord( false );
                        } );
                } else {
                    return _complete( true, true );
                }
            } else {
                return _complete( true, true );
            }
        } );
}

function _closeParticipant() {

    // If the form is untouched, and has not loaded a record, allow closing it without any checks.
    // TODO: can we ignore calculations?
    if ( settings.type !== 'edit' && Object.keys( fieldSubmissionQueue.get() ).length === 0 && fieldSubmissionQueue.submittedCounter === 0 ) {
        return Promise.resolve()
            .then( () => {
                gui.alert( t( 'alert.submissionsuccess.redirectmsg' ), null, 'success' );
                // this event is used in communicating back to iframe parent window
                document.dispatchEvent( events.Close() );
                _redirect( 600 );
            } );
    }

    return form.validate()
        .then( valid => {
            if ( !valid ) {
                const strictViolations = form.view.html
                    .querySelector( settings.strictViolationSelector );

                valid = !strictViolations;
            }
            if ( valid ) {
                return _closeSimple();
            }
            gui.alertStrictBlock();
        } );
}

function _redirect( msec ) {
    ignoreBeforeUnload = true;
    setTimeout( () => {
        location.href = decodeURIComponent( settings.returnUrl || DEFAULT_THANKS_URL );
    }, msec || 1200 );
}

/**
 * Finishes a submission
 */
function _complete( bypassConfirmation = false, bypassChecks = false ) {

    if ( !bypassConfirmation ) {
        return gui.confirm( {
            heading: t( 'fieldsubmission.confirm.complete.heading' ),
            msg: t( 'fieldsubmission.confirm.complete.msg' )
        } );
    }

    // form.validate() will trigger fieldsubmissions for timeEnd before it resolves
    return form.validate()
        .then( valid => {
            if ( !valid && !bypassChecks ) {
                const strictViolations = form.view.html
                    .querySelector( settings.strictViolationSelector );
                if ( strictViolations ) {
                    gui.alertStrictBlock();
                } else if ( form.view.html.querySelector( '.invalid-relevant' ) ) {
                    gui.alert( t( 'fieldsubmission.alert.relevantvalidationerror.msg' ) );
                } else {
                    gui.alert( t( 'fieldsubmission.alert.validationerror.msg' ) );
                }
            } else {
                let beforeMsg;
                let authLink;
                let instanceId;
                let deprecatedId;
                let msg = '';

                form.view.$.trigger( 'beforesave' );

                beforeMsg = t( 'alert.submission.redirectmsg' );
                authLink = `<a href="/login" target="_blank">${t( 'here' )}</a>`;

                gui.alert( `${beforeMsg}<div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>`, t( 'alert.submission.msg' ), 'bare' );

                return fieldSubmissionQueue.submitAll()
                    .then( () => {
                        const queueLength = Object.keys( fieldSubmissionQueue.get() ).length;

                        if ( queueLength === 0 ) {
                            instanceId = form.instanceID;
                            deprecatedId = form.deprecatedID;
                            return fieldSubmissionQueue.complete( instanceId, deprecatedId );
                        } else {
                            throw new Error( t( 'fieldsubmission.alert.complete.msg' ) );
                        }
                    } )
                    .then( () => {
                        // this event is used in communicating back to iframe parent window
                        document.dispatchEvent( events.SubmissionSuccess() );

                        msg += t( 'alert.submissionsuccess.redirectmsg' );
                        gui.alert( msg, t( 'alert.submissionsuccess.heading' ), 'success' );
                        _redirect();
                    } )
                    .catch( result => {
                        result = result || {};
                        console.error( 'submission failed' );
                        if ( result.status === 401 ) {
                            msg = t( 'alert.submissionerror.authrequiredmsg', {
                                here: authLink
                            } );
                        } else {
                            msg = result.message || gui.getErrorResponseMsg( result.status );
                        }
                        gui.alert( msg, t( 'alert.submissionerror.heading' ) );
                    } );
            }
        } );
}

/**
 * Triggers autoqueries. 
 * @param {*} $questions 
 */
function _autoAddQueries( questions ) {
    questions.forEach( q => {
        if ( q.matches( '.question' ) ) {
            q.dispatchEvent( events.AddQuery() );
        } else if ( q.matches( '.or-group.invalid-relevant, .or-group-data.invalid-relevant' ) ) {
            q.querySelectorAll( '.question:not(.or-appearance-dn)' ).forEach( el => el.dispatchEvent( events.AddQuery() ) );
        }
    } );
}

function _autoAddReasonQueries( $rfcInputs ) {
    $rfcInputs.val( t( 'widget.dn.autonoreason' ) ).trigger( 'change' );
}

function _doNotSubmit( fullPath ) {
    // no need to check on cloned radiobuttons, selects or textareas
    const pathWithoutPositions = fullPath.replace( /\[[0-9]+\]/g, '' );
    return !!form.view.$.get( 0 ).querySelector( `input[oc-external="clinicaldata"][name="${pathWithoutPositions}"]` );
}

function _setFormEventHandlers() {

    form.view.html.addEventListener( events.ProgressUpdate().type, event => {
        if ( event.target.classList.contains( 'or' ) && formprogress && event.detail ) {
            formprogress.style.width = `${event.detail}%`;
        }
    } );

    // After repeat removal from view (before removal from model)
    form.view.html.addEventListener( events.Removed().type, event => {
        const updated = event.detail || {};
        const instanceId = form.instanceID;
        if ( !updated.xmlFragment ) {
            console.error( 'Could not submit repeat removal fieldsubmission. XML fragment missing.' );
            return;
        }
        if ( !instanceId ) {
            console.error( 'Could not submit repeat removal fieldsubmission. InstanceID missing' );
        }

        postHeartbeat();
        fieldSubmissionQueue.addRepeatRemoval( updated.xmlFragment, instanceId, form.deprecatedID );
        if ( clearedForSubmissions ) {
            fieldSubmissionQueue.submitAll();
        }
    } );
    // Field is changed
    form.view.html.addEventListener( events.DataUpdate().type, event => {
        const updated = event.detail || {};
        const instanceId = form.instanceID;
        let file;

        if ( updated.cloned ) {
            // This event is fired when a repeat is cloned. It does not trigger
            // a fieldsubmission.
            return;
        }
        if ( !updated.xmlFragment ) {
            console.error( 'Could not submit field. XML fragment missing. (If repeat was deleted, this is okay.)' );
            return;
        }
        if ( !instanceId ) {
            console.error( 'Could not submit field. InstanceID missing' );
            return;
        }
        if ( !updated.fullPath ) {
            console.error( 'Could not submit field. Path missing.' );
        }
        if ( _doNotSubmit( updated.fullPath ) ) {
            return;
        }
        if ( updated.file ) {
            file = fileManager.getCurrentFile( updated.file );
        }

        // remove the Participate class that shows a Close button on every page
        form.view.html.classList.remove( 'empty-untouched' );

        // Only now will we check for the deprecatedID value, which at this point should be (?) 
        // populated at the time the instanceID dataupdate event is processed and added to the fieldSubmission queue.
        postHeartbeat();
        fieldSubmissionQueue.addFieldSubmission( updated.fullPath, updated.xmlFragment, instanceId, form.deprecatedID, file );
        if ( clearedForSubmissions ) {
            fieldSubmissionQueue.submitAll();
        }
    } );

    // Before repeat removal from view and model
    if ( settings.reasonForChange ) {

        $( '.form-footer' ).find( '.next-page, .last-page, .previous-page, .first-page' ).on( 'click', evt => {
            const valid = reasons.validate();
            if ( !valid ) {
                evt.stopImmediatePropagation();

                return false;
            }
            reasons.clearAll();
            return true;
        } );
    }
}

function _setButtonEventHandlers() {
    $( 'button#finish-form' ).click( function() {
        const $button = $( this ).btnBusyState( true );

        _complete()
            .then( again => {
                if ( again ) {
                    return _complete( again );
                }
            } )
            .catch( e => {
                gui.alert( e.message );
            } )
            .then( () => {
                $button.btnBusyState( false );
            } );

        return false;
    } );

    $( 'button#close-form-regular' ).click( function() {
        const $button = $( this ).btnBusyState( true );

        _closeRegular()
            .then( again => {
                if ( again ) {
                    return _closeRegular( true );
                }
            } )
            .catch( e => {
                console.error( e );
            } )
            .then( () => {
                $button.btnBusyState( false );
            } );

        return false;
    } );

    // This is for closing a record that was marked as final. It's quite different
    // from Complete or the regular Close.
    $( 'button#close-form-complete' ).click( function() {
        const $button = $( this ).btnBusyState( true );

        // form.validate() will trigger fieldsubmissions for timeEnd before it resolves
        _closeCompletedRecord()
            .catch( e => {
                gui.alert( e.message );
            } )
            .then( () => {
                $button.btnBusyState( false );
            } );

        return false;
    } );

    // This is for closing a record in a readonly or note-only view.
    $( 'button#close-form-read' ).click( function() {
        const $button = $( this ).btnBusyState( true );

        _closeSimple()
            .catch( e => {
                gui.alert( e.message );
            } )
            .then( () => {
                $button.btnBusyState( false );
            } );

        return false;
    } );

    // This is for closing a participant view.
    $( 'button#close-form-participant' ).click( function() {
        const $button = $( this ).btnBusyState( true );

        _closeParticipant()
            .catch( e => {
                gui.alert( e.message );
            } )
            .then( () => {
                $button.btnBusyState( false );
            } );

        return false;
    } );

    if ( rc.inIframe() && settings.parentWindowOrigin ) {
        document.addEventListener( events.SubmissionSuccess().type, rc.postEventAsMessageToParentWindow );
        document.addEventListener( events.Edited().type, rc.postEventAsMessageToParentWindow );
        document.addEventListener( events.Close().type, rc.postEventAsMessageToParentWindow );

        form.view.html.addEventListener( events.PageFlip().type, postHeartbeat );
        form.view.html.addEventListener( events.AddRepeat().type, postHeartbeat );
        form.view.html.addEventListener( events.Heartbeat().type, postHeartbeat );
    }

    window.onbeforeunload = () => {
        if ( !ignoreBeforeUnload ) {
            _autoAddQueries( form.view.html.querySelectorAll( '.invalid-constraint' ) );
            _autoAddReasonQueries( reasons.getInvalidFields() );
            if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                return 'Any unsaved data will be lost';
            }
        }
    };
}

function postHeartbeat() {
    if ( rc.inIframe() && settings.parentWindowOrigin ) {
        rc.postEventAsMessageToParentWindow( events.Heartbeat() );
    }
}

export default {
    init
};
