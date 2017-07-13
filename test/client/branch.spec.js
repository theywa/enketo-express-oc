/* global describe, it, expect, beforeEach */
'use strict';

var Form = require( '../../public/js/src/module/Form' );
var forms = require( './forms/forms' );

var loadForm = function( filename ) {
    var strings = forms[ filename ];
    return new Form( strings.html_form, {
        modelStr: strings.xml_model
    } );
};

describe( 'Customized Branching Logic', function() {
    var a = '[name="/relevant-constraint-required/something"]';
    var b = '[name="/relevant-constraint-required/rep/val"]';
    var c = '[name="/relevant-constraint-required/rep/skipq"]';

    describe( 'disabled class', function() {
        var form;

        beforeEach( function() {
            form = loadForm( 'relevant_constraint_required.xml' );
            form.init();
            form.view.$.find( a ).val( 'a' ).trigger( 'change' );
            form.view.$.find( b ).val( 'diarrhea' ).trigger( 'change' );
        } );

        // Test if we haven't messed up Enketo Core's default functionality
        it( 'is still added if value is empty', function() {
            // not disabled
            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'disabled' ) ).to.equal( false );
            // make c irrelevant
            form.view.$.find( b ).val( 'd' ).trigger( 'change' );
            // check if disabled
            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'disabled' ) ).to.equal( true );
        } );

        // Test OC-custom functionality
        it( 'is not added if value is non-empty (1)', function() {
            // add value to c
            form.view.$.find( c ).val( 5 ).trigger( 'change' );
            // not disabled
            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'disabled' ) ).to.equal( false );
            // make c irrelevant
            form.view.$.find( b ).val( 'd' ).trigger( 'change' );
            // check if disabled
            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'disabled' ) ).to.equal( false ); // FALSE!
        } );

        // Test OC-custom functionality
        it( 'is not added if value is non-empty (2)', function() {
            // add value to c
            form.view.$.find( a ).val( 'nothing' ).trigger( 'change' );
            // check if disabled
            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'disabled' ) ).to.equal( false ); // FALSE!
        } );

    } );

    describe( 'with relevant error', function() {
        var form;

        beforeEach( function() {
            form = loadForm( 'relevant_constraint_required.xml' );
            form.init();
            form.view.$.find( a ).val( 'a' ).trigger( 'change' );
            form.view.$.find( b ).val( 'diarrhea' ).trigger( 'change' );
            // add value to c
            form.view.$.find( c ).val( 5 ).trigger( 'change' );
            // make c irrelevant
            form.view.$.find( b ).val( 'd' ).trigger( 'change' );
        } );

        it( 'shown to alert user that value is non-empty (1)', function() {
            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'invalid-relevant' ) ).to.equal( true );
        } );

        it( 'shown to alert user that value is non-empty (2)', function() {
            form.view.$.find( a ).val( 'nothing' ).trigger( 'change' );
            expect( form.view.$.find( b ).closest( '.question' ).hasClass( 'invalid-relevant' ) ).to.equal( true );
        } );

        it( 'removed if value changes from non-empty to empty', function() {
            // remove value for c
            form.view.$.find( c ).val( '' ).trigger( 'change' );
            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'invalid-relevant' ) ).to.equal( false );
        } );
    } );

} );
