'use strict';

var $ = require( 'jquery' );
var t = require( 'translator' ).t;

module.exports = {
    get $section() {
        this._$section = this._$section || $( '<section class="reason-for-change"><h5 class="reason-for-change__heading">' +
            t( 'fieldsubmission.reason.heading' ) + '</h5></section>' ).insertBefore( '.form-footer' );
        return this._$section;
    },
    fields: [],
    numbers: [],
    addField: function( question ) {
        var $field;
        var $repeatNumber;
        var repeatNumber;
        var index;
        console.log( 'adding to reason for change section', this.fields );
        if ( this.fields.indexOf( question ) === -1 ) {
            // No need to worry about nested repeats as OC doesn't use them.
            $repeatNumber = $( question ).closest( '.or-repeat' ).find( '.repeat-number' );
            if ( $repeatNumber.length ) {
                repeatNumber = $repeatNumber.text() || 1;
                index = this.numbers.indexOf( $repeatNumber[ 0 ] );
                if ( index === -1 ) {
                    index = this.numbers.length;
                    this.numbers[ index ] = $repeatNumber[ 0 ];
                }
            }
            $field = $( '<div class="reason-for-change__item">' +
                '<span class="reason-for-change__item__label">' +
                $( question ).find( '.question-label.active' ).text() + '</span>' +
                ( repeatNumber ? '<span class="reason-for-change__item__repeat-number" data-index="' + index + '">(' + repeatNumber + ')</span>' : '' ) +
                '<input class="ignore" type="text" placeholder="' + t( 'fieldsubmission.reason.placeholder' ) + '"/></div>' );
            this.fields.push( question );
            return $field.appendTo( this.$section );
        }
        return $();
    },
    removeField: function( question ) {
        var index = this.fields.indexOf( question );
        if ( index !== -1 ) {
            this.fields.splice( index, 1 );
            // is this robust?
            this.$section.find( '.reason-for-change__item' ).eq( index ).remove();
        }
    },
    clearAll: function() {
        this.$section.find( '.reason-for-change__item' ).remove();
        this.fields = [];
    },
    setInvalid: function( inputEl ) {
        this.changeFieldStatus( inputEl, 'invalid' );
    },
    setValid: function( inputEl ) {
        this.changeFieldStatus( inputEl, 'added' );
    },
    setPending: function( inputEl ) {
        this.changeFieldStatus( inputEl );
    },
    setNumber: function( el, number ) {
        el.textContent = '(' + number + ')';
    },
    changeFieldStatus: function( inputEl, status ) {
        inputEl.classList.remove( 'added', 'invalid' );
        if ( status ) {
            inputEl.classList.add( status );
        }
    },
    updateNumbering: function() {
        var that = this;
        // removing repeats has a delay
        setTimeout( function() {
            that.$section.find( '.reason-for-change__item__repeat-number' ).each( function() {
                that.setNumber( this, that.numbers[ this.dataset.index ].textContent );
            } );
        }, 800 );
    },
    validate: function() {
        var that = this;
        var valid = true;

        this.$section.find( 'input:not(.added)' ).each( function() {
            that.setInvalid( this );
            valid = false;
        } );

        return valid;
    }
};
