/* global describe, it, expect */

import Dn from '../../widget/discrepancy-note/dn-widget';
Dn.prototype._init = () => {};
const fragment = document.createRange().createContextualFragment(
    `<form>
        <label class="question">
            <input name="/data/node"/>
        </label>
        <label class="question or-appearance-dn">
            <input name="/data/comment" data-for="/data/node">
        </label>
    </form>`
);
const el = fragment.querySelector( '[data-for]' );

describe( 'DN object', () => {

    describe( 'parses JSON string', () => {
        const dn = new Dn( el );

        [ 'a', '[]', '{queries:[], logs:[]}', true, null, false, {},
            [], {
                a: true
            }, {
                "queries": [],
                "logs": []
            }
        ].forEach( test => {
            it( 'throws an error, if the JSON string is invalid or not a string', () => {
                const parse = () => {
                    dn._parseModelFromString( test );
                };
                expect( parse ).to.throw( /Failed to parse discrepancy/ );
            } );
        } );

        [ '', '{}' ].forEach( test => {
            it( 'returns an empty model if the JSON string is an empty string or an empty stringified object', () => {
                expect( dn._parseModelFromString( test ) ).to.deep.equal( {
                    queries: [],
                    logs: []
                } );
            } );
        } );

        [
            '{"queries":[], "logs":[]}',
            '{"queries":[],"logs": [{ "type": "comment", "status": "updated", "message": "This is an older comment.", "user" : "Maurice Moss (moss)", "date_time" : "2016-04-22 14:44:20 -06:00"},{ "type": "audit",  "message": "Item data value updated from old_value to new_value.",  "user" : "Jen Barber (jen)","date_time" : "2016-05-18 12:44:20 -06:00" }]}'
        ].forEach( test => {
            it( 'returns the correct model if the JSON string is a valid stringified object', () => {
                expect( dn._parseModelFromString( test ) ).to.deep.equal( JSON.parse( test ) );
            } );
        } );

    } );


    describe( 'extracts the current status from the discrepancy note data model', () => {
        const dn = new Dn( el );

        [
            [ '{}', '' ],
            [ '{"queries":[], "logs":[{"type": "comment"}]}', '' ],
            [ '{"queries":[], "logs":[{"type": "comment", "status": "updated"}]}', 'updated' ],
            [ '{"queries":[], "logs":[{"type": "audit"},{"type": "comment", "status": "updated"}]}', 'updated' ],
            [ '{"queries":[], "logs":[{"type": "comment", "status":"new"},{"type": "comment", "status": "updated"}]}', 'new' ],
            [ '{"queries":[{"type": "comment", "status": "closed"}], "logs":[{"type": "comment", "status": "updated"}]}', 'closed' ],
        ].forEach( test => {
            it( 'and returns the correct status', () => {
                const model = dn._parseModelFromString( test[ 0 ] );
                expect( model ).to.be.an( 'object' );
                expect( dn._getCurrentStatus( model ) ).to.equal( test[ 1 ] );
            } );
        } );
    } );

    describe( 'getting parsed elapsed time from datetime string', () => {
        const dn = new Dn( el );

        [ false, true, null, 'a', {},
            []
        ].forEach( test => {
            it( 'returns "error" when an invalid datetime string is provided', () => {
                expect( dn._getParsedElapsedTime( test ) ).to.equal( 'error' );
            } );
        } );
    } );

    describe( 'parsing elapsed time from milliseconds', () => {
        const dn = new Dn( el );

        [ -1, -Infinity, false, true, null, 'a', {},
            []
        ].forEach( test => {
            it( 'returns "error" when not a number or a negative number is provided', () => {
                expect( dn._getParsedElapsedTime( test ) ).to.equal( 'error' );
            } );
        } );

        [
            [ 0, 'widget.dn.zerominutes' ],
            [ 29999, 'widget.dn.zerominutes' ],
            [ 30000, '1 minute(s)' ],
            [ 59.5 * 60 * 1000 - 1, '59 minute(s)' ],
            [ 59.5 * 60 * 1000, '1 hour(s)' ],
            [ 1.5 * 60 * 60 * 1000, '2 hour(s)' ],
            [ 23.5 * 60 * 60 * 1000 - 1, '23 hour(s)' ],
            [ 23.5 * 60 * 60 * 1000, '1 day(s)' ],
            [ ( 5 / 12 + 30 - 0.5 ) * 24 * 60 * 60 * 1000 - 1, '30 day(s)' ],
            [ ( 5 / 12 + 30 - 0.5 ) * 24 * 60 * 60 * 1000, '1 month(s)' ],
            [ 11.5 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000 - 1, '11 month(s)' ],
            [ 11.5 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000, '1 year(s)' ],
            [ 1.5 * 12 * ( 5 / 12 + 30 ) * 24 * 60 * 60 * 1000, '2 year(s)' ],
        ].forEach( test => {
            it( 'returns correct human-readable response', () => {
                expect( dn._parseElapsedTime( test[ 0 ] ) ).to.equal( test[ 1 ] );
            } );
        } );
    } );

    describe( 'sorting queries and logs', () => {
        const dn = new Dn( el );
        const a = {
            date_time: "2016-09-01 15:01 -06:00"
        };
        const b = {
            date_time: "2016-09-01 14:01:00.001 -06:00"
        };
        const c = {
            date_time: "2016-09-01 14:01 -06:00"
        };
        const d = {};

        [
            [ a, b, c, d ],
            [ a, b, d, c ],
            [ a, c, d, b ],
            [ a, c, b, d ],
            [ a, d, b, c ],
            [ a, d, c, b ],
            [ b, a, c, d ],
            [ b, a, d, c ],
            [ b, c, a, d ],
            [ b, c, d, a ],
            [ b, d, a, c ],
            [ b, d, c, a ],
            [ c, a, b, d ],
            [ c, a, d, b ],
            [ c, b, a, d ],
            [ c, b, d, a ],
            [ c, d, a, b ],
            [ c, d, b, a ],
            [ d, a, b, c ],
            [ d, a, c, b ],
            [ d, b, a, c ],
            [ d, b, c, a ],
            [ d, c, a, b ],
            [ d, c, b, a ]
        ].forEach( test => {
            it( `sorts by datetime in descending order: ${JSON.stringify( test )}`, () => {
                expect( test.sort( dn._datetimeDesc.bind( dn ) ) ).to.deep.equal( [ a, b, c, d ] );
            } );
        } );
    } );

    describe( 'extracting default assignee', () => {
        const dn = new Dn( el );
        [
            [ '{}', '' ],
            [ '{"queries":[], "logs":[{"type": "comment"}]}', '' ],
            // first has system user
            [ '{"queries":[], "logs":[{"type": "comment", "status": "updated", "user": "root", "date_time":2}]}', '' ],
            [ '{"queries":[{"type": "comment", "status": "updated", "user": "root", "date_time":2}], "logs":[]}', '' ],
            // first has empty user
            [ '{"queries":[], "logs":[{"type": "audit", "user": "", "date_time":2000},{"type": "comment", "user": "jen", "date_time":1000}]}', '' ],
            [ '{"queries":[{"type": "audit", "user": "", "date_time":2},{"type": "comment", "user": "jen",  "date_time":1}], "logs":[]}', '' ],
            // first has no user
            [ '{"queries":[], "logs":[{"type": "audit", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}]}', '' ],
            [ '{"queries":[{"type": "audit", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}], "logs":[]}', '' ],
            // first root ignored, next is taken
            [ '{"queries":[], "logs":[{"type": "audit", "user": "root", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}]}', 'jen' ],
            [ '{"queries":[{"type": "audit", "user": "root", "date_time":2},{"type": "comment", "user": "jen", "date_time":1}], "logs":[]}', 'jen' ],
            // same, but switched order (same date_time) to test ordering
            [ '{"queries":[], "logs":[{"type": "comment", "user": "jen", "date_time":1}, {"type": "audit", "user": "root", "date_time":2}]}', 'jen' ],
            [ '{"queries":[{"type": "comment", "user": "jen", "date_time":1}, {"type": "audit", "user": "root", "date_time":2}], "logs":[]}', 'jen' ],
        ].forEach( test => {
            it( 'works', () => {
                const notes = dn._parseModelFromString( test[ 0 ] );
                expect( dn._getDefaultAssignee( notes ) ).to.equal( test[ 1 ] );
            } );
        } );
    } );

} );
