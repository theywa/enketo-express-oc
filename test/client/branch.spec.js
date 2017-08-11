/* global describe, it, expect, beforeEach */
'use strict';

var Form = require( '../../public/js/src/module/Form' );
var forms = require( './forms/forms' );
var chai = require( 'chai' );
var expect = chai.expect;
var chaiAsPromised = require( 'chai-as-promised' );

var loadForm = function( filename ) {
    var strings = forms[ filename ];
    return new Form( strings.html_form, {
        modelStr: strings.xml_model
    } );
};

describe( 'Customized Branching Logic', function() {
    var a = '[name="/data/something"]';
    var b = '[name="/data/rep/val"]';
    var c = '[name="/data/rep/skipq"]';
    var r = '[name="/data/rep"]';

    describe( 'for individual questions', function() {

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


        describe( 'with relevant error interacting with constraint error', function() {
            var form;

            beforeEach( function( done ) {
                form = loadForm( 'relevant_constraint_required.xml' );
                form.init();
                form.view.$.find( a ).val( 'afdgsgsfafdfadssf' ).trigger( 'change' );
                form.view.$.find( b ).val( 'diarrhea' ).trigger( 'change' );
                // add value to c that fails constraint
                form.view.$.find( c ).val( 5 ).trigger( 'change' );
                // make c irrelevant (and still failing constraint validation too)
                form.view.$.find( b ).val( 'diarrheadafsdsfdasd' ).trigger( 'change' );
                setTimeout( function() {
                    done();
                }, 500 );
            } );

            it( 'shows relevant error but not constraint error when form.validate() is called', function() {
                return form.validate()
                    .then( function( result ) {
                        return Promise.all( [
                            expect( result ).to.equal( false ),
                            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'invalid-relevant' ) ).to.equal( true ),
                            expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'invalid-constraint' ) ).to.equal( false ),
                        ] );
                    } );
            } );

        } );

        describe( 'resets relevantError', function() {
            var form;

            beforeEach( function( done ) {
                form = loadForm( 'relevant_constraint_required.xml' );
                form.init();
                form.view.$.find( a ).val( 'a' ).trigger( 'change' );
                form.view.$.find( b ).val( 'd' ).trigger( 'change' );
                // make b irrelevant
                form.view.$.find( a ).val( 'nothing' ).trigger( 'change' );
                setTimeout( function() {
                    done();
                }, 500 );
            } );

            it( 'when question becomes relevant again', function() {
                expect( form.view.$.find( b ).closest( '.question' ).hasClass( 'invalid-relevant' ) ).to.equal( true );
                // make b relevant again
                form.view.$.find( a ).val( 'a' ).trigger( 'change' );
                expect( form.view.$.find( c ).closest( '.question' ).hasClass( 'invalid-relevant' ) ).to.equal( false );
            } );
        } );

    } );


    describe( 'for groups', function() {

        describe( 'disabled class', function() {
            var form;

            beforeEach( function() {
                form = loadForm( 'relevant_group.xml' );
                form.init();
                form.view.$.find( a ).val( 'a' ).trigger( 'change' );
            } );

            // Test if we haven't messed up Enketo Core's default functionality
            it( 'is still added if value is empty', function() {
                // r not disabled
                expect( form.view.$.find( r ).hasClass( 'disabled' ) ).to.equal( false );
                // make r irrelevant (no values inside repeat)
                form.view.$.find( a ).val( '' ).trigger( 'change' );
                // r now disabled
                expect( form.view.$.find( r ).hasClass( 'disabled' ) ).to.equal( true );
            } );

            // Test OC-custom functionality
            it( 'is not added if a user-entered value inside group is non-empty', function() {
                // add value inside repeat
                form.view.$.find( b ).val( 'diarrhea' ).trigger( 'change' );
                // make r irrelevant (while it contains value)
                form.view.$.find( a ).val( '' ).trigger( 'change' );
                // r not disabled
                expect( form.view.$.find( r ).hasClass( 'disabled' ) ).to.equal( false ); // FALSE!
            } );

            // Test OC-custom functionality
            it( 'is not added if multiple user-entered values are non-emptys', function() {
                // add value to b
                form.view.$.find( b ).val( 'diarrhea' ).trigger( 'change' );
                // add value to c
                form.view.$.find( c ).val( '4' ).trigger( 'change' );
                // check if disabled
                expect( form.view.$.find( r ).hasClass( 'disabled' ) ).to.equal( false ); // FALSE!
            } );

        } );

        describe( 'with relevant error', function() {
            var form;

            beforeEach( function() {
                form = loadForm( 'relevant_group.xml' );
                form.init();
                form.view.$.find( a ).val( 'a' ).trigger( 'change' );
                form.view.$.find( b ).val( 'diarrhea' ).trigger( 'change' );
                // add value to c
                form.view.$.find( c ).val( 5 ).trigger( 'change' );
                // make r irrelevant
                form.view.$.find( a ).val( '' ).trigger( 'change' );
            } );

            it( 'shown to alert user that a user-entered value is non-empty', function() {
                expect( form.view.$.find( r ).hasClass( 'invalid-relevant' ) ).to.equal( true );
            } );

            it( 'removed if group becomes relevant again', function() {
                // remove one value
                form.view.$.find( a ).val( 'a' ).trigger( 'change' );
                expect( form.view.$.find( r ).hasClass( 'invalid-relevant' ) ).to.equal( false );
            } );

            it( 'removed when all user-entered values have changed from non-empty to empty', function() {
                // remove one value
                form.view.$.find( c ).val( '' ).trigger( 'change' );
                expect( form.view.$.find( r ).hasClass( 'invalid-relevant' ) ).to.equal( true );
                // remove remaining value
                form.view.$.find( b ).val( '' ).trigger( 'change' );
                expect( form.view.$.find( r ).hasClass( 'invalid-relevant' ) ).to.equal( false );
            } );

        } );

    } );
} );
