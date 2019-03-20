import Widget from 'enketo-core/src/js/widget';
import $ from 'jquery';
import { t } from '../../public/js/src/module/translator';
import settings from '../../public/js/src/module/settings';
import events from '../../public/js/src/module/event';
import fileManager from '../../public/js/src/module/file-manager';
let usersOptionsHtml;
let currentUser;
let users;
const SYSTEM_USER = 'root';
import reasons from '../../public/js/src/module/reasons';

const pad2 = x => ( x < 10 ) ? `0${x}` : x;

/**
 * Visually transforms a question into a comment modal that can be shown on its linked question.
 */
class Comment extends Widget {

    static get selector() {
        return '.or-appearance-dn input[type="text"][data-for], .or-appearance-dn textarea[data-for]';
    }

    static get helpersRequired() {
        return [ 'input', 'pathToAbsolute', 'evaluate', 'getModelValue' ];
    }

    _init() {
        this.$linkedQuestion = this._getLinkedQuestion( this.element );

        if ( this.$linkedQuestion.length === 1 ) {
            this.$commentQuestion = $( this.element ).closest( '.question' );
            this.ordinal = 0;
            this.readOnly = this.element.readOnly;

            this.linkedQuestionReadonly = this.$linkedQuestion[ 0 ]
                .querySelector( 'input:not(.ignore), textarea:not(.ignore), select:not(.ignore)' ).readOnly;
            this.notes = this._parseModelFromString( this.element.value );
            this.defaultAssignee = this._getDefaultAssignee( this.notes );
            this.$commentQuestion.addClass( 'hide' ).attr( 'role', 'comment' );
            // Any <button> inside a <label> receives click events if the <label> is clicked!
            // See http://codepen.io/MartijnR/pen/rWJeOG?editors=1111
            this.$commentButton = $( '<a class="btn-icon-only btn-comment btn-dn" tabindex="-1" type="button" href="#"><i class="icon"> </i></a>' );
            this._setCommentButtonState( this.element.value, '', this._getCurrentStatus( this.notes ) );
            this.$linkedQuestion.find( '.question-label' ).last().after( this.$commentButton );
            this._setUserOptions( this.readOnly );
            this._setCommentButtonHandler();
            this._setValidationHandler();
            this._setDisabledHandler();
            this._setValueChangeHandler();
            this._setCloseHandler();
            this._setFocusHandler();
            this._setConstraintEvaluationHandler();
            this._setRepeatRemovalReasonChangeHandler();
            this._setPrintOptimizationHandler();
        }
    }

    /**
     * This function should only be called by init (upon load).
     * @return {string} [description]
     */
    _getDefaultAssignee( notes ) {
        let defaultAssignee = '';

        notes.queries.concat( notes.logs ).sort( this._datetimeDesc.bind( this ) ).some( item => {
            if ( item.user === SYSTEM_USER ) {
                return false;
            }
            defaultAssignee = item.user || '';
            return true;
        } );

        return defaultAssignee;
    }

    _getLinkedQuestion( element ) {
        const $input = $( element );
        const contextPath = this.options.helpers.input.getName( $input );
        const targetPath = element.dataset.for.trim();
        const absoluteTargetPath = this.options.helpers.pathToAbsolute( targetPath, contextPath );
        // The root is nearest repeat or otherwise nearest form. This avoids having to calculate indices, without
        // diminishing the flexibility in any meaningful way, 
        // as it e.g. wouldn't make sense to place a comment node for a top-level question, inside a repeat.
        const $root = $( element ).closest( 'form.or, .or-repeat' );

        return this.options.helpers.input
            .getWrapNodes( $root.find( `[name="${absoluteTargetPath}"], [data-name="${absoluteTargetPath}"]` ) )
            .eq( 0 );
    }

    _setCommentButtonState( value, error, state ) {
        this.$commentButton
            .toggleClass( 'new', state === 'new' )
            .toggleClass( 'closed', state === 'closed' )
            .toggleClass( 'closed-modified', state === 'closed-modified' )
            .toggleClass( 'updated', state === 'updated' )
            .toggleClass( 'invalid', !!error );
    }

    _commentHasError() {
        return this.$commentQuestion.hasClass( 'invalid-required' ) || this.$commentQuestion.hasClass( 'invalid-constraint' );
    }

    _setCommentButtonHandler() {
        const that = this;
        this.$commentButton.click( () => {
            if ( that._isCommentModalShown( that.$linkedQuestion[ 0 ] ) ) {
                that._hideCommentModal( that.$linkedQuestion[ 0 ] );
            } else {
                const errorMsg = that._getCurrentErrorMsg();
                that._showCommentModal( errorMsg );
            }
            return false;
        } );
    }

    _setValidationHandler() {
        const that = this;

        // Update query icon if query question is invalid.
        this.$commentQuestion[ 0 ].addEventListener( events.Invalidated().type, () => {
            that._setCommentButtonState( that.element.value, true );
        } );
    }

    _setPrintOptimizationHandler() {
        this.$commentQuestion
            .on( 'printify.enketo', this._printify.bind( this ) )
            .on( 'deprintify.enketo', this._deprintify.bind( this ) );
    }

    _setCloseHandler() {
        const that = this;

        this.$linkedQuestion.on( 'addquery.oc', function() {
            const currentStatus = that._getCurrentStatus( that.notes );
            const errorType = this.classList.contains( 'invalid-constraint' ) ? 'constraint' : ( this.classList.contains( 'invalid-required' ) ? 'required' : ( this.classList.contains( 'invalid-relevant' ) ? 'relevant' : null ) );
            if ( errorType && currentStatus !== 'updated' && currentStatus !== 'new' ) {
                const status = ( currentStatus === '' ) ? 'new' : 'updated';
                const errorMsg = $( this ).find( `.or-${errorType}-msg.active` ).text();
                that._addQuery( t( 'widget.dn.autoconstraint', {
                    errorMsg
                } ), status, '', false, SYSTEM_USER );
            }
        } );
    }

    _setFocusHandler() {
        const that = this;
        this.element.addEventListener( events.ApplyFocus().type, () => {
            if ( that.$commentButton.is( ':visible' ) ) {
                that.$commentButton.click();
            } else {
                let err = `${t( 'alert.goto.hidden' )} `;
                const goToErrorLink = settings.goToErrorUrl ? `<a href="${settings.goToErrorUrl}">${settings.goToErrorUrl}</a>` : '';
                err += goToErrorLink ? t( 'alert.goto.msg2', {
                    miniform: goToErrorLink,
                    // switch off escaping
                    interpolation: {
                        escapeValue: false
                    }
                } ) : t( 'alert.goto.msg1' );
                throw new Error( err );
            }
        } );
    }

    /**
     * Observes the disabled state of the linked question, and automatically generates
     * an audit log if:
     * 1. The question gets disabled and the query is currently 'open'.
     */
    _setDisabledHandler() {
        let comment;
        let status;
        let currentStatus;
        let linkedVal;
        let open;
        const that = this;
        const target = this.$linkedQuestion.get( 0 ).querySelector( 'input, select, textarea' );
        const $target = $( target );

        this.$linkedQuestion.on( 'hiding.oc', () => {
            // For now there is no need to doublecheck if this question has a relevant attribute 
            // or has an ancestor group with a relevant attribute. This is because we trust that
            // the "hiding.oc" event is sent only for branches or its children when being closed (by the branch module).
            currentStatus = that._getCurrentStatus( that.notes );
            open = currentStatus === 'updated' || currentStatus === 'new';
            linkedVal = that.options.helpers.input.getVal( $target );
            // Note that getVal() can return an empty array.
            if ( open && linkedVal.length === 0 ) {
                // This will not be triggered if a form is loaded with a value for an irrelevant question and an open query.
                comment = t( 'widget.dn.autoclosed' );
                status = 'closed';
            }
            if ( comment ) {
                that._addQuery( comment, status, '', false, SYSTEM_USER );
            }
        } );
    }

    /**
     * Listens to a value change of the linked question and generates an audit log (and optionally a query).
     */
    _setValueChangeHandler() {
        const that = this;
        let previousValue = this.options.helpers.getModelValue( $( this.$linkedQuestion.get( 0 ).querySelector( 'input, select, textarea' ) ) );

        this.$linkedQuestion.on( 'valuechange inputupdate', evt => {
            let comment;
            const currentValue = that.options.helpers.getModelValue( $( evt.target ) );
            const currentStatus = that._getCurrentStatus( that.notes );
            // Note obtaining the values like this does not work for file input types, but since have a different
            // change comment for those that doesn't mention the filename, we don't need to fix that.

            if ( evt.target.type !== 'file' ) {
                comment = t( 'widget.dn.valuechange', {
                    'new': `"${currentValue}"`,
                    'previous': `"${previousValue}"`
                } );
            } else {
                comment = currentValue ? t( 'widget.dn.newfile' ) : t( 'widget.dn.fileremoved' );
            }

            that._addAudit( comment, '', false );

            if ( settings.reasonForChange && !that.linkedQuestionReadonly ) {
                reasons.addField( that.$linkedQuestion[ 0 ] )
                    .on( 'change', evt => {
                        // Also for empty onchange values
                        // TODO: exclude empty values if RFC field never had a value?
                        that._addReason( evt.target.value );
                        reasons.setSubmitted( evt.target );
                    } )
                    .on( 'input', evt => {
                        if ( evt.target.value && evt.target.value.trim() ) {
                            reasons.setEdited( evt.target );
                        }
                    } );

                reasons.applyToAll();
            }

            previousValue = currentValue;

            if ( currentStatus === 'closed' ) {
                comment = t( 'widget.dn.closedmodified' );
                that._addQuery( comment, 'closed-modified', '', false, SYSTEM_USER );
            }
        } );
    }

    _setRepeatRemovalReasonChangeHandler() {
        const that = this;
        if ( settings.reasonForChange && !that.linkedQuestionReadonly ) {
            this.$linkedQuestion[ 0 ].addEventListener( events.ReasonChange().type, function( event ) {
                if ( event.detail && event.detail.reason ) {
                    that._addReason( event.detail.reason );
                    reasons.removeField( this );
                } else {
                    console.error( 'no reason provided' );
                }
            } );
        }
    }

    /**
     * Listen for a custom constraintevaluated.oc event in order to create a query if the status is closed.
     * 
     * This listener is meant for the following situation:
     * 1. a form is loaded with a query for question A with status 'closed' and a constraint that has a dependency on question B
     * 2. the value of question B is changed, triggering a re-evaluation of the constraint of question A
     * 3. regardless of the constraint evaluation result, this should add an autoquery to A and change the status to closed-modified
     */
    _setConstraintEvaluationHandler() {
        const that = this;
        this.$linkedQuestion.on( 'constraintevaluated.oc', ( event, updated ) => {
            let comment;
            const currentStatus = that._getCurrentStatus( that.notes );
            /*
             * If during a session a query is closed, and this triggers a contraintUpdate of the linked question,
             * we do not want to generate an autoquery.
             * 
             * updated.fullPath includes positions (of repeats) which we need to strip
             */
            if ( currentStatus === 'closed' && updated.fullPath.replace( /\[\d+\]/g, '' ) !== that.element.getAttribute( 'name' ) ) {
                comment = t( 'widget.dn.closedmodified' );
                that._addQuery( comment, 'closed-modified', '', false, SYSTEM_USER );
            }
        } );
    }

    _isCommentModalShown( linkedQuestion ) {
        return !!linkedQuestion.querySelector( '.or-comment-widget' );
    }

    /**
     * If the linked question is not shown full width, ensure that the comment question is.
     * This correction is meant for the Grid Theme.
     * 
     */
    _getFullWidthStyleCorrection() {
        const $form = this.$linkedQuestion.closest( 'form' );
        const fullWidth = this.$linkedQuestion.closest( '.or-repeat' ).width() || $form.width();
        // select the first question on the current page
        const firstQuestionOnCurrentPage = $form[ 0 ].querySelector( '[role="page"].current.question, [role="page"].current .question' ) || $form[ 0 ].querySelector( '.question' );
        const mostLeft = $( firstQuestionOnCurrentPage ).position().left;
        const linkedQuestionWidth = this.$linkedQuestion.outerWidth();
        const linkedQuestionLeft = this.$linkedQuestion.position().left;

        // By correcting the left we can make this function agnostic to themes.
        return {
            width: `${fullWidth * 100 / linkedQuestionWidth}%`,
            left: `${( mostLeft - linkedQuestionLeft ) * 100 / linkedQuestionWidth}%`
        };
    }

    _showCommentModal( linkedQuestionErrorMsg ) {
        const range = document.createRange();
        const comment = this.element.closest( '.question' ).cloneNode( true );
        const noClose = settings.dnCloseButton !== true;
        const submitText = t( 'formfooter.submit.btn' ) || 'Submit';
        const updateText = t( 'widget.comment.update' ) || 'Update';
        const closeText = t( 'widget.dn.closeQueryText' ) || 'Close Query';
        const assignText = t( 'widget.dn.assignto' ) || 'Assign To'; // TODO: add string to kobotoolbox/enketo-express
        const notifyText = t( 'widget.dn.notifyText' ) || 'Email?'; // TODO: add string to kobotoolbox/enketo-express
        const closeButtonHtml = '<button class="btn-icon-only or-comment-widget__content__btn-close-x" type="button">&times;</button>';
        const newQueryButtonHtml = `<button name="new" class="btn btn-primary or-comment-widget__content__btn-submit" type="button">${submitText}</button>`;
        const updateQueryButtonHtml = `<button name="updated" class="btn btn-primary or-comment-widget__content__btn-submit" type="button">${updateText}</button>`;
        const closeQueryButtonHtml = noClose ? '' : `<button name="closed" class="btn btn-default or-comment-widget__content__btn-submit" type="button">${closeText}</button>`;
        const status = this._getCurrentStatus( this.notes );
        const readOnlyAttr = this.readOnly ? 'readonly ' : '';

        this.element.closest( 'form' ).dispatchEvent( events.Heartbeat() );

        let btnsHtml;
        if ( status === 'new' || status === 'updated' || status === 'closed-modified' ) {
            btnsHtml = updateQueryButtonHtml + closeQueryButtonHtml;
        } else if ( status === 'closed' ) {
            btnsHtml = updateQueryButtonHtml;
        } else {
            btnsHtml = newQueryButtonHtml;
        }
        const btnGroupHtml = `<div class="or-comment-widget__content__query-btns">${btnsHtml}</div>`;

        comment.classList.remove( 'hide' );
        comment.removeAttribute( 'role' );

        const input = comment.querySelector( 'input, textarea' );
        input.classList.add( 'ignore' );
        input.removeAttribute( 'data-for' );
        input.removeAttribute( ' data-type-xml' );
        input.setAttribute( 'name', 'dn-comment' );
        input.value = linkedQuestionErrorMsg;

        const fragment = range.createContextualFragment(
            `<section class="widget or-comment-widget">
                <div class="or-comment-widget__overlay"></div>
                <form onsubmit="return false;" class="or-comment-widget__content" autocomplete="off">
                    <div class="or-comment-widget__content__tabs">
                        <label>
                            <input type="radio"  class="ignore" name="dn-type" value="comment" checked />
                            <span>query</span>
                        </label>
                        <label>
                            <input type="radio" class="ignore" name="dn-type" value="annotation" />
                            <span>annotation</span>
                        </label>
                    </div>
                    <div class="or-comment-widget__content__user">
                        <label class="or-comment-widget__content__user__dn-assignee">
                            <span>${assignText}</span>
                            <select name="dn-assignee" class="ignore" >${usersOptionsHtml}</select>
                        </label>
                        <div class="or-comment-widget__content__user__dn-notify option-wrapper">
                            <label>
                                <input name="dn-notify" class="ignore" value="true" type="checkbox" ${readOnlyAttr}/>
                                <span class="option-label">${notifyText}</span>
                            </label>
                        </div>
                    </div>
                    ${closeButtonHtml}
                    ${btnGroupHtml}
                    <div class="or-comment-widget__content__history closed">
                        <p></p>
                        <table></table>
                    </div>
                </section>
            </form>`
        );

        fragment.querySelector( '.or-comment-widget__content__tabs' ).after( comment );

        const oldWidget = this.$linkedQuestion[ 0 ].querySelector( '.or-comment-widget' );
        if ( oldWidget ) {
            oldWidget.remove();
        }
        this.$linkedQuestion[ 0 ].prepend( fragment );

        const widget = this.$linkedQuestion[ 0 ].querySelector( '.or-comment-widget' );

        // Display widget in full form width even if its linked question is not a full row (in the Grid theme)
        Object.entries( this._getFullWidthStyleCorrection() ).forEach( o => {
            widget.style[ o[ 0 ] ] = o[ 1 ];
        } );

        this.$history = $( widget.querySelector( '.or-comment-widget__content__history' ) );
        this._renderHistory();

        const queryButtons = widget.querySelectorAll( '.or-comment-widget__content__query-btns .btn' );

        input.addEventListener( 'input', () => {
            queryButtons.forEach( el => el.disabled = !input.value.trim() );
        } );
        input.dispatchEvent( new Event( 'input' ) );
        input.focus();

        widget.querySelector( 'form.or-comment-widget__content' ).addEventListener( 'submit', () => {
            const btn = widget.querySelector( '.btn[name="updated"], .btn[name="new"]' );
            if ( btn ) {
                btn.click();
            }
        } );
        widget.scrollIntoView( false );

        queryButtons.forEach( btn => {
            btn.addEventListener( 'click', event => {
                if ( input.value ) {
                    const comment = input.value;
                    const assignee = widget.querySelector( 'select[name="dn-assignee"]' ).value;
                    const notify = widget.querySelector( 'input[name="dn-notify"]' ).checked;
                    const type = widget.querySelector( 'input[name="dn-type"]:checked' ).value;
                    const status = type !== 'annotation' ? event.target.getAttribute( 'name' ) : undefined;
                    this._addQuery( comment, status, assignee, notify, null, type );
                    input.value = '';
                    this._hideCommentModal( this.$linkedQuestion[ 0 ] );
                }
                event.preventDefault();
                event.stopPropagation();
            } );
        } );

        const closeButton = widget.querySelector( '.or-comment-widget__content__btn-close-x' );
        const overlay = widget.querySelector( '.or-comment-widget__overlay' );
        [ closeButton, overlay ].forEach( el => {
            el.addEventListener( 'click', event => {
                this._hideCommentModal( this.$linkedQuestion[ 0 ] );
                event.preventDefault();
                event.stopPropagation();
            } );
        } );
    }

    _hideCommentModal( linkedQuestion ) {
        this.element.closest( 'form' ).dispatchEvent( events.Heartbeat() );
        linkedQuestion.querySelector( '.or-comment-widget' ).remove();
    }

    /**
     * Sets users, currentUser, and usersOptionsHtml global variables (once for all dn widgets);
     * 
     * @param {boolean=} readOnly 
     */
    _setUserOptions( readOnly ) {
        if ( !usersOptionsHtml ) {
            const disabled = readOnly ? 'disabled' : '';
            const defaultAssignee = this.defaultAssignee;
            try {
                const userNodes = this.options.helpers.evaluate( 'instance("_users")/root/item', 'nodes', null, null, true );

                // doing this in 2 steps as it is likely useful later on to store the users array separately.
                users = userNodes.map( item => ( {
                    firstName: item.querySelector( 'first_name' ).textContent,
                    lastName: item.querySelector( 'last_name' ).textContent,
                    userName: item.querySelector( 'user_name' ).textContent
                } ) );
                usersOptionsHtml = `<option value="" ${disabled}></option>${users.map( user => {
                    const readableName = `${user.firstName} ${user.lastName} (${user.userName})`;
                    const selected = user.userName === defaultAssignee ? ' selected ' : '';
                    return `<option value="${user.userName}"${selected}${disabled}>${readableName}</option>`;
                } )}`;

                const currentUsernameNode = this.options.helpers.evaluate( 'instance("_users")/root/item[@current]/user_name', 'node', null, null, true );
                currentUser = currentUsernameNode ? currentUsernameNode.textContent : null;
            } catch ( e ) {
                //users = [];
                console.error( e );
            }
        }
    }

    _getCurrentErrorMsg() {
        if ( this.$linkedQuestion.hasClass( 'invalid-required' ) ) {
            return this.$linkedQuestion.find( '.or-required-msg.active' ).text();
        } else if ( this.$linkedQuestion.hasClass( 'invalid-constraint' ) ) {
            return this.$linkedQuestion.find( '.or-constraint-msg.active' ).text();
        } else {
            return '';
        }
    }

    _parseModelFromString( str ) {
        try {
            if ( str.trim().length > 0 ) {
                const model = JSON.parse( str );
                if ( typeof model !== 'object' || Array.isArray( model ) ) {
                    throw new Error( 'Parsed JSON is not an object.' );
                }
                if ( typeof model.queries === 'undefined' ) {
                    model.queries = [];
                }
                if ( typeof model.logs === 'undefined' ) {
                    model.logs = [];
                }
                return model;
            } else {
                return {
                    queries: [],
                    logs: []
                };
            }
        } catch ( e ) {
            console.error( e );
            throw new Error( 'Failed to parse discrepancy notes.' );
        }
    }

    _datetimeDesc( a, b ) {
        const aDate = new Date( this._getIsoDatetimeStr( a.date_time ) );
        const bDate = new Date( this._getIsoDatetimeStr( b.date_time ) );
        if ( bDate.toString() === 'Invalid Date' || aDate > bDate ) {
            return -1;
        }
        if ( aDate.toString() === 'Invalid Date' || aDate < bDate ) {
            return 1;
        }
        return 0;
    }

    _getParsedElapsedTime( datetimeStr ) {
        const dt = new Date( this._getIsoDatetimeStr( datetimeStr ) );
        if ( typeof datetimeStr !== 'string' || dt.toString() === 'Invalid Date' ) {
            console.error( `Could not convert datetime string "${datetimeStr}" to a Date object.` );
            return 'error';
        }
        return this._parseElapsedTime( new Date() - dt );
    }

    _getReadableDateTime( datetimeStr ) {
        const dt = new Date( this._getIsoDatetimeStr( datetimeStr ) );
        if ( typeof datetimeStr !== 'string' || dt.toString() === 'Invalid Date' ) {
            console.error( `Could not convert datetime string "${datetimeStr}" to a Date object.` );
            return 'error';
        }
        // 13-Jun-2018 13:58 UTC-04:00
        return `${pad2( dt.getDate() )}-${dt.toLocaleDateString( 'en', { month: 'short' } )}-${dt.getFullYear()} ${pad2( dt.getHours() )}:${pad2( dt.getMinutes() )} UTC${dt.getTimezoneOffsetAsTime()}`;
        // Date.getTimezoneOffsetAsTime is an extension in enketo-xpathjs
    }

    _parseElapsedTime( elapsedMilliseconds ) {
        let months;
        let days;
        let hours;
        let minutes;

        if ( isNaN( elapsedMilliseconds ) || elapsedMilliseconds < -120000 ) {
            console.error( `Could not parse elapsed time for elapsed milliseconds: "${elapsedMilliseconds}"` );
            return 'error';
        }

        // To work around negative values due to incorrect times on OC server or client device,
        // we tolerate up to -2 minutes.
        if ( elapsedMilliseconds < 0 ) {
            console.error( 'Negative time difference of less than 2 minutes. Setting to "Just Now"' );
            elapsedMilliseconds = 1;
        }

        minutes = elapsedMilliseconds / ( 1000 * 60 );
        // TODO: translateable strings with plural?
        if ( minutes < 0.5 ) {
            return t( 'widget.dn.zerominutes' ) || 'Just now';
        }
        if ( minutes < 59.5 ) {
            return `${Math.round( minutes )} minute(s)`;
        }
        hours = minutes / 60;
        if ( hours < 23.5 ) {
            return `${Math.round( hours )} hour(s)`;
        }
        days = hours / 24;
        if ( days < ( 5 / 12 + 30 - 0.5 ) ) {
            return `${Math.round( days )} day(s)`;
        }
        months = days / ( 5 / 12 + 30 );
        if ( months < 11.5 ) {
            return `${Math.round( months )} month(s)`;
        }
        return `${Math.round( months / 12 )} year(s)`;
    }

    _addQuery( comment, status, assignee, notify, user, type = 'comment' ) {
        const that = this;
        const q = {
            type,
            id: ( ++this.ordinal ).toString(),
            date_time: this._getFormattedCurrentDatetimeStr(),
            comment,
            status,
            assigned_to: assignee,
            notify
        };

        if ( user ) {
            q.user = user;
        }

        this.notes.queries.unshift( q );

        // Strip logs from model
        // This also automatically leaves out undefined properties such as status!
        const modelDataStr = JSON.stringify( {
            queries: that.notes.queries
        } );

        // Update XML Model
        this.originalInputValue = modelDataStr;
        const error = this._commentHasError();
        this._setCommentButtonState( this.originalInputValue, error, this._getCurrentStatus( this.notes ) );
    }

    _addAudit( comment, assignee, notify ) {
        this.notes.logs.unshift( {
            type: 'audit',
            date_time: this._getFormattedCurrentDatetimeStr(),
            comment,
            assigned_to: assignee,
            notify
        } );
    }

    _addReason( reason ) {
        let modelDataStr;
        const that = this;
        let q;

        if ( !reason ) {
            return;
        }

        q = {
            type: 'reason',
            id: ( ++this.ordinal ).toString(),
            date_time: this._getFormattedCurrentDatetimeStr(),
            comment: reason
        };

        this.notes.queries.unshift( q );

        // strip logs from model
        modelDataStr = JSON.stringify( {
            queries: that.notes.queries
        } );

        // update XML Model
        $( this.element ).val( modelDataStr ).trigger( 'change' );
    }

    _getCurrentStatus( notes ) {
        let status = '';

        notes.queries.concat( notes.logs ).some( item => {
            if ( item.status ) {
                status = item.status;
                return true;
            }
            return false;
        } );
        return status;
    }

    _getFormattedCurrentDatetimeStr() {
        const now = new Date();
        const offset = {};

        offset.minstotal = now.getTimezoneOffset();
        offset.direction = ( offset.minstotal < 0 ) ? '+' : '-';
        offset.hrspart = pad2( Math.abs( Math.floor( offset.minstotal / 60 ) ) );
        offset.minspart = pad2( Math.abs( Math.floor( offset.minstotal % 60 ) ) );

        return new Date( now.getTime() - ( offset.minstotal * 60 * 1000 ) ).toISOString()
            .replace( 'T', ' ' )
            .replace( 'Z', ` ${offset.direction}${offset.hrspart}:${offset.minspart}` );
    }

    _getIsoDatetimeStr( dateTimeStr ) {
        let parts;
        if ( typeof dateTimeStr === 'string' ) {
            parts = dateTimeStr.split( ' ' );
            return `${parts[ 0 ]}T${parts[ 1 ]}${parts[ 2 ]}`;
        }
        return dateTimeStr;
    }

    _renderHistory() {
        const that = this;
        const emptyText = t( 'widget.dn.emptyHistoryText' ) || 'No History';
        const historyText = t( 'widget.dn.historyText' ) || 'History';
        const user = '<span class="icon fa-user"> </span>';
        const clock = '<span class="icon fa-clock-o"> </span>';

        const over3 = this.notes.queries.concat( this.notes.logs ).length - 3;
        const $more = over3 > 0 ? $( `<tr><td colspan="4"><span class="over">+${over3}</span><button class="btn-icon-only btn-more-history"><i class="icon"> </i></button></td></tr>` ) : $();
        const $colGroup = this.notes.queries.concat( this.notes.logs ).length > 0 ? $( '<colgroup><col style="width: 31px;"><col style="width: auto;"></colgroup>' ) : $();
        this.$history.find( 'table' ).empty()
            .append( $colGroup )
            .append( `<thead><tr><th colspan="2" scope="col"><strong>${historyText}</strong></th><th scope="col">${user}</th><th scope="col">${clock}</th></tr></thead>` )
            .append( `<tbody>${this.notes.queries.concat( this.notes.logs ).sort( this._datetimeDesc.bind( this ) ).map( item => that._getRows( item ) )
                .join( '' ) || `<tr><td colspan="2">${emptyText}</td><td></td><td></td></tr>`}</tbody>` )
            .find( 'tbody' )
            .append( $more );

        this.$history
            .on( 'click', 'tbody td', function() {
                $( this ).toggleClass( 'wrapping', this.scrollWidth > this.clientWidth );
            } )
            .on( 'mouseenter', 'tbody td', function() {
                $( this ).toggleClass( 'overflowing', this.scrollWidth > this.clientWidth );
            } );

        $more.find( '.btn-more-history' ).on( 'click', () => {
            that.$history.toggleClass( 'closed' );
            return false;
        } );
    }

    _linkify( comment ) {
        // This relies on a auto-generated string with 2 filenames surrounded by quotation marks, e.g.
        // Value changed from "img1.jpg" to "img2.jpg".
        const reg = /"([^"]+)"/g;
        let linkifiedComment = comment;
        let i = 0;
        let results;

        // for first 0, 1, or 2 matches:
        while ( ( results = reg.exec( comment ) ) !== null && i < 2 ) {
            const filename = results[ 1 ];
            if ( filename ) {
                const fileUrl = fileManager.getInstanceAttachmentUrl( filename );
                if ( fileUrl ) {
                    linkifiedComment = linkifiedComment.replace( filename, `<a target="_blank" rel="noreferrer" href="${fileUrl}">${filename}</a>` );
                }
            }
            i++;
        }

        return linkifiedComment;
    }

    _getRows( item, options ) {
        const types = {
            comment: '<span class="icon tooltip fa-comment-o" data-title="Query/Comment"> </span>',
            audit: '<span class="icon tooltip fa-edit" data-title="Audit Event"> </span>',
            reason: '<span class="icon tooltip icon-delta" data-title="Reason for Change"> </span>',
            annotation: '<span class="icon tooltip icon-pencil" data-title="Annotation"> </span>'
        };
        if ( typeof item.user === 'undefined' ) {
            item.user = currentUser;
        }
        if ( typeof options !== 'object' ) {
            options = {};
        }
        //const msg = this._linkify( item.comment || item.message );
        const msg = item.comment || item.message;
        const rdDatetime = this._getReadableDateTime( item.date_time );
        const time = ( options.timestamp === 'datetime' ) ? rdDatetime : this._getParsedElapsedTime( item.date_time );

        const fullName = this._parseFullName( item.user ) || t( 'widget.dn.me' );

        return `<tr><td>${types[ item.type ] || ''}</td><td>${msg}</td><td><span class="username tooltip" data-title="${fullName} (${item.user})">${fullName}</span></td><td class="datetime tooltip" data-title="${rdDatetime}">${time}</td></tr>`;
    }

    _parseFullName( user ) {
        let fullName;

        if ( !user ) {
            return '';
        }

        users.some( u => {
            if ( u.userName === user ) {
                fullName = `${u.firstName} ${u.lastName}`;
                return true;
            }
        } );

        // use unchanged user as fallback if no match is found
        return fullName || user;
    }

    // Amend DN question to optimize for printing. Does not have to be undone, as it is not 
    // use during regular data entry.
    _printify() {
        let labelText;
        const that = this;

        if ( this.$linkedQuestion.is( '.or-appearance-analog-scale' ) ) {
            const $clone = this.$linkedQuestion.find( '.question-label.widget.active' ).clone();
            $clone.find( 'ul, br' ).remove();
            labelText = $clone.text();
        } else {
            labelText = this.$linkedQuestion.find( '.question-label.active' ).text();
        }

        this.$commentQuestion
            .addClass( 'printified' )
            .append( `<table class="temp-print">${this.notes.queries.concat( this.notes.logs ).sort( this._datetimeDesc.bind( this ) ).map( item => that._getRows( item, { timestamp: 'datetime' } ) ).join( '' )}</table>` );

        const $existingLabel = this.$commentQuestion.find( '.question-label.active' );

        $existingLabel.attr( 'data-original', $existingLabel.text() );
        $existingLabel.text( `History for - ${labelText}` );
    }

    _deprintify() {
        this.$commentQuestion
            .removeClass( 'printified' )
            .find( 'table.temp-print' ).remove();

        const $existingLabel = this.$commentQuestion.find( '.question-label.active' );
        $existingLabel.text( $existingLabel.attr( 'data-original' ) );

    }

}

export default Comment;
