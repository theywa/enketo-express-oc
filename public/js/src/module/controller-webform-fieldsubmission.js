/**
 * Deals with the main high level survey controls for the special online-only auto-fieldsubmission view.
 *
 * Field values are automatically submitted upon change to a special OpenClinica Field Submission API.
 */

import gui from './gui';

import settings from './settings';
import Form from './Form'; // modified for OC
import fileManager from './file-manager';
import Promise from 'lie';
import { t } from './translator';
import $ from 'jquery';
import FieldSubmissionQueue from './field-submission-queue';
let fieldSubmissionQueue;
import rc from './controller-webform';
import reasons from './reasons';
const DEFAULT_THANKS_URL = '/thanks';
let form;
let formSelector;
let $formprogress;
let ignoreBeforeUnload = false;

const formOptions = {
    printRelevantOnly: settings.printRelevantOnly
};


function init( selector, data, loadWarnings ) {
    let advice;
    let loadErrors = [].concat( loadWarnings );

    formSelector = selector;
    $formprogress = $( '.form-progress' );

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
            if ( settings.strictCheckEnabled && settings.type !== 'edit' ) {
                form.view.html.classList.add( 'empty-untouched' );
            }
            // For all Participant views, use a hacky solution to change the default relevant message
            if ( settings.strictCheckEnabled ) {
                const list = form.view.html.querySelectorAll( '[data-i18n="constraint.relevant"]' );
                for ( let i = 0; i < list.length; i++ ) {
                    const relevantErrorMsg = t( 'constraint.relevantparticipant' );
                    list[ i ].textContent = relevantErrorMsg;
                }
            }

            // set form eventhandlers before initializing form
            _setFormEventHandlers( selector );

            // listen for "gotohidden.enketo" event and add error
            $( formSelector ).on( 'gotohidden.enketo', e => {
                // In OC hidden go_to fields should show loadError except if go_to field is a disrepancy_note
                // as those are always hidden upon load.
                if ( !e.target.classList.contains( 'or-appearance-dn' ) ) {
                    loadErrors.push( t( 'alert.goto.hidden' ) );
                }
            } );

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
            $( 'body > .main-loader' ).remove();

            if ( settings.goTo && location.hash ) {
                // form.goTo returns an array of 1 error if it has error. We're using our special
                // knowledge of Enketo Core to replace this error
                let goToErrors = form.goTo( location.hash.substring( 1 ) );
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
                loadErrors = loadErrors.concat( goToErrors );
            }

            if ( form.encryptionKey ) {
                loadErrors.unshift( `<strong>${t( 'error.encryptionnotsupported' )}</strong>` );
            }

            rc.setLogoutLinkVisibility();

            if ( loadErrors.length > 0 ) {
                throw loadErrors;
            }

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
        .then( form => {
            if ( settings.headless ) {
                console.log( 'doing headless things' );
                const $result = $( '<div id="headless-result" style="position: fixed; background: pink; top: 0; left: 50%;"/>' );
                if ( loadErrors.length ) {
                    $result.append( `<span id="error">${loadErrors[ 0 ]}</span>` );
                    $( 'body' ).append( $result );
                    return form;
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
                        return form;
                    } );
            }
        } )
        .then( form => // OC will return even if there were errors.
            form );
}

function _headlessValidateAndAutoQuery( valid ) {
    const markedAsComplete = form.model.isMarkedComplete();
    let $invalid = $();

    if ( !valid ) {
        if ( markedAsComplete ) {
            $invalid = form.view.$.find( '.invalid-relevant, .invalid-constraint, .invalid-required' );
        } else {
            $invalid = form.view.$.find( '.invalid-relevant, .invalid-constraint' );
        }
        // Trigger auto-queries for relevant, constraint and required (handled in DN widget)
        _autoAddQueries( $invalid );
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
 * TODO: I think this can probably be reorganized to avoid the bypassAutoQuery parameter. 
 * See the _closeCompleteRecord for example.
 * 
 * @return {Promise} [description]
 */
function _closeRegular( bypassAutoQuery ) {
    let msg = '';
    const tAlertCloseMsg = t( 'fieldsubmission.alert.close.msg1' );
    const tAlertCloseHeading = t( 'fieldsubmission.alert.close.heading1' );
    const authLink = `<a href="/login" target="_blank">${t( 'here' )}</a>`;
    const $violated = form.view.$.find( '.invalid-constraint' );

    // First check if any constraints have been violated and prompt option to generate automatic queries
    if ( !bypassAutoQuery && $violated.length ) {
        return gui.confirm( {
                heading: t( 'alert.default.heading' ),
                errorMsg: t( 'fieldsubmission.confirm.autoquery.msg1' ),
                msg: t( 'fieldsubmission.confirm.autoquery.msg2' )
            }, {
                posButton: t( 'fieldsubmission.confirm.autoquery.automatic' ),
                negButton: t( 'fieldsubmission.confirm.autoquery.manual' ),
            } )
            .then( confirmed => {
                if ( confirmed ) {
                    _autoAddQueries( $violated );
                }
                return confirmed;
            } );
    }

    // Start with actually closing, but only proceed once the queue is emptied.
    gui.alert( `${tAlertCloseMsg}<br/><div class="loader-animation-small" style="margin: 40px auto 0 auto;"/>`, tAlertCloseHeading, 'bare' );

    return fieldSubmissionQueue.submitAll()
        .then( () => {
            if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                throw new Error( t( 'fieldsubmission.alert.close.msg2' ) );
            } else {
                // this event is used in communicating back to iframe parent window
                $( document ).trigger( 'close' );

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
                            $( document ).trigger( 'close' );
                            _redirect( 100 );
                        }
                    } );
            }

        } );
}

function _closeSimple() {
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
                $( document ).trigger( 'close' );

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
                            $( document ).trigger( 'close' );
                            _redirect( 100 );
                        }
                    } );
            }
        } );
}

// This is conceptually a Complete function that has some pre-processing.
function _closeCompletedRecord() {
    let $violated;

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
            if ( valid ) {
                // do not show confirmation dialog
                return _complete( true );
            } else if ( form.view.$.find( '.invalid-relevant' ).length ) {
                gui.alert( t( 'fieldsubmission.alert.relevantvalidationerror.msg' ) );
                return false;
            } else {
                $violated = form.view.$.find( '.invalid-constraint, .invalid-required' );
                // Note that unlike _close this also looks at .invalid-required.
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
                        _autoAddQueries( $violated );
                        return _closeCompletedRecord();
                    } );
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
                $( document ).trigger( 'close' );
                _redirect( 600 );
            } );
    }

    return form.validate()
        .then( valid => {
            if ( !valid ) {
                const strictViolations = form.view.html
                    .querySelector( '.oc-strict.invalid-required, .oc-strict.invalid-constraint, .oc-strict.invalid-relevant' );

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
 *
 * TODO: I think this can probably be reorganized to avoid the bypassConfirmation parameter. 
 * See the _closeCompleteRecord for example.
 * 
 */
function _complete( bypassConfirmation ) {
    let beforeMsg;
    let authLink;
    let instanceId;
    let deprecatedId;
    let msg = '';

    // First check if any constraints have been violated and prompt option to generate automatic queries
    if ( !bypassConfirmation ) {
        return gui.confirm( {
            heading: t( 'fieldsubmission.confirm.complete.heading' ),
            msg: t( 'fieldsubmission.confirm.complete.msg' )
        } );
    }

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
            $( document ).trigger( 'submissionsuccess' );

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

/**
 * Triggers autoqueries. 
 * @param {*} $questions 
 */
function _autoAddQueries( $questions ) {
    $questions.trigger( 'addquery.oc' );
}

function _autoAddReasonQueries( $rfcInputs ) {
    $rfcInputs.val( t( 'widget.dn.autonoreason' ) ).trigger( 'change' );
}

function _doNotSubmit( fullPath ) {
    // no need to check on cloned radiobuttons, selects or textareas
    const pathWithoutPositions = fullPath.replace( /\[[0-9]+\]/g, '' );
    return !!form.view.$.get( 0 ).querySelector( `input[oc-external="clinicaldata"][name="${pathWithoutPositions}"]` );
}

function _setFormEventHandlers( selector ) {
    const $doc = $( document );
    $doc
        .on( 'progressupdate.enketo', selector, ( event, status ) => {
            if ( $formprogress.length > 0 ) {
                $formprogress.css( 'width', `${status}%` );
            }
        } )
        // After repeat removal from view (before removal from model)
        .on( 'removed.enketo', ( event, updated ) => {
            const instanceId = form.instanceID;
            if ( !updated.xmlFragment ) {
                console.error( 'Could not submit repeat removal fieldsubmission. XML fragment missing.' );
                return;
            }
            if ( !instanceId ) {
                console.error( 'Could not submit repeat removal fieldsubmission. InstanceID missing' );
            }

            fieldSubmissionQueue.addRepeatRemoval( updated.xmlFragment, instanceId, form.deprecatedID );
            fieldSubmissionQueue.submitAll();
        } )
        // Field is changed
        .on( 'dataupdate.enketo', selector, ( event, updated ) => {
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
            fieldSubmissionQueue.addFieldSubmission( updated.fullPath, updated.xmlFragment, instanceId, form.deprecatedID, file );
            fieldSubmissionQueue.submitAll();

        } );

    // Before repeat removal from view and model
    if ( settings.reasonForChange ) {
        // We need to catch the click before repeat.js does. So 
        // we attach the handler to a lower level DOM element and make sure it's only attached once.
        $( '.or-repeat-info' ).parent( '.or-group, .or-group-data' ).on( 'click.propagate', 'button.remove:enabled', ( evt, data ) => {
            if ( data && data.propagate ) {
                return true;
            }
            // Any form controls inside the repeat need a Reason for Change
            // TODO: exclude controls that have no value?
            const $questions = $( evt.currentTarget ).closest( '.or-repeat' ).find( '.question:not(.disabled)' );
            const texts = {
                heading: t( 'fieldsubmission.prompt.repeatdelete.heading' ),
                msg: `${t( 'fieldsubmission.prompt.repeatdelete.msg' )} ${t( 'fieldsubmission.prompt.reason.msg' )}`
            };
            const inputs = '<p><label><input name="reason" type="text"/></label></p>';

            gui.prompt( texts, {}, inputs )
                .then( values => {
                    if ( !values ) {
                        return;
                    } else if ( !values.reason || !values.reason.trim() ) {
                        // TODO: something
                        return;
                    } else {
                        $questions.trigger( 'reasonchange.enketo', values );
                        // Propagate to repeat.js
                        $( evt.currentTarget ).trigger( 'click', {
                            propagate: true
                        } );
                        reasons.updateNumbering();
                    }
                } );

            return false;
        } );

        $( '.form-footer' ).find( '.next-page, .last-page, .previous-page, .first-page' ).on( 'click', evt => {
            const valid = reasons.validate();
            if ( !valid ) {
                evt.stopImmediatePropagation();

                return false;
            }
            reasons.clearAll();
            return true;
        } );
    } else {
        // We need to catch the click before repeat.js does. So 
        // we attach the handler to a lower level DOM element and make sure it's only attached once.
        $( '.or-repeat-info' ).parent( '.or-group, .or-group-data' ).on( 'click.propagate', 'button.remove:enabled', ( evt, data ) => {
            if ( data && data.propagate ) {
                return true;
            }
            const texts = {
                heading: t( 'fieldsubmission.prompt.repeatdelete.heading' ),
                msg: t( 'fieldsubmission.prompt.repeatdelete.msg' )
            };
            gui.confirm( texts )
                .then( confirmed => {
                    if ( confirmed ) {
                        // Propagate to repeat.js
                        $( evt.currentTarget ).trigger( 'click', {
                            propagate: true
                        } );
                    }
                } );

            return false;
        } );
    }
}

function _setButtonEventHandlers() {
    $( 'button#finish-form' ).click( function() {
        const $button = $( this ).btnBusyState( true );

        // form.validate() will trigger fieldsubmissions for timeEnd before it resolves
        form.validate()
            .then( valid => {
                if ( valid ) {
                    return _complete()
                        .then( again => {
                            if ( again ) {
                                return _complete( again );
                            }
                        } );
                } else {
                    if ( form.view.$.find( '.invalid-relevant' ).length ) {
                        gui.alert( t( 'fieldsubmission.alert.relevantvalidationerror.msg' ) );
                    } else {
                        gui.alert( t( 'fieldsubmission.alert.validationerror.msg' ) );
                    }
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
        $( document ).on( 'submissionsuccess edited.enketo close', rc.postEventAsMessageToParentWindow );
    }

    window.onbeforeunload = () => {
        if ( !ignoreBeforeUnload ) {
            _autoAddQueries( form.view.$.find( '.invalid-constraint' ) );
            _autoAddReasonQueries( reasons.getInvalidFields() );
            if ( Object.keys( fieldSubmissionQueue.get() ).length > 0 ) {
                return 'Any unsaved data will be lost';
            }
        }
    };
}

export default {
    init
};
