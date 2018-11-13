/* global describe, it, beforeEach*/

import chai from 'chai';
const expect = chai.expect;
import chaiAsPromised from 'chai-as-promised';
import utils from '../../public/js/src/module/utils';
import FieldSubmissionQueue from '../../public/js/src/module/field-submission-queue';

chai.use( chaiAsPromised );

const getFieldValue = fd => utils.blobToString( fd.getAll( 'xml_submission_fragment_file' )[ 0 ] );

describe( 'Field Submission', () => {
    const p1 = '/a/b/c';
    const p2 = '/a/r[3]/d';
    const id = 'abc';
    const did = 'def';

    describe( 'queue', () => {

        it( 'adds regular items', () => {
            const q = new FieldSubmissionQueue();
            q.addFieldSubmission( p1, '<one>1</one>', id );
            q.addFieldSubmission( p2, '<a>a</a>', id );

            return Promise.all( [
                expect( Object.keys( q.get() ).length ).to.equal( 2 ),
                expect( q.get()[ `POST_${p1}` ] ).to.be.an.instanceOf( FormData ),
                expect( q.get()[ `POST_${p2}` ] ).to.be.an.instanceOf( FormData ),
                expect( getFieldValue( q.get()[ `POST_${p1}` ] ) ).to.eventually.equal( '<one>1</one>' ),
                expect( getFieldValue( q.get()[ `POST_${p2}` ] ) ).to.eventually.equal( '<a>a</a>' )
            ] );
        } );

        it( 'overwrites older values in the queue for the same node', () => {
            const q = new FieldSubmissionQueue();
            q.addFieldSubmission( p1, '<one>1</one>', id );
            q.addFieldSubmission( p1, '<two>2</two>', id );

            return Promise.all( [
                expect( Object.keys( q.get() ).length ).to.equal( 1 ),
                expect( q.get()[ `POST_${p1}` ] ).to.be.an.instanceOf( FormData ),
                expect( getFieldValue( q.get()[ `POST_${p1}` ] ) ).to.eventually.deep.equal( '<two>2</two>' )
            ] );
        } );

        it( 'adds edits of already submitted items', () => {
            const q = new FieldSubmissionQueue();
            q.addFieldSubmission( p1, '<one>1</one>', id, did );
            q.addFieldSubmission( p2, '<a>a</a>', id, did );

            return Promise.all( [
                expect( Object.keys( q.get() ).length ).to.equal( 2 ),
                expect( q.get()[ `PUT_${p1}` ] ).to.be.an.instanceOf( FormData ),
                expect( q.get()[ `PUT_${p2}` ] ).to.be.an.instanceOf( FormData ),
                expect( getFieldValue( q.get()[ `PUT_${p1}` ] ) ).to.eventually.equal( '<one>1</one>' ),
                expect( getFieldValue( q.get()[ `PUT_${p2}` ] ) ).to.eventually.equal( '<a>a</a>' )
            ] );
        } );

        it( 'overwrites older values of edited already-submitted items', () => {
            const q = new FieldSubmissionQueue();
            q.addFieldSubmission( p1, '<one>1</one>', id, did );
            q.addFieldSubmission( p1, '<two>2</two>', id, did );

            return Promise.all( [
                expect( Object.keys( q.get() ).length ).to.equal( 1 ),
                expect( q.get()[ `PUT_${p1}` ] ).to.be.an.instanceOf( FormData ),
                expect( getFieldValue( q.get()[ `PUT_${p1}` ] ) ).to.eventually.equal( '<two>2</two>' )
            ] );
        } );

        it( 'adds items that delete a repeat', () => {
            const q = new FieldSubmissionQueue();
            q.addRepeatRemoval( '<one>1</one>', id );
            q.addRepeatRemoval( '<a>a</a>', id, did );

            return Promise.all( [
                expect( Object.keys( q.get() ).length ).to.equal( 2 ),
                expect( q.get()[ 'DELETE_0' ] ).to.be.an.instanceOf( FormData ),
                expect( q.get()[ 'DELETE_1' ] ).to.be.an.instanceOf( FormData ),
                expect( getFieldValue( q.get()[ 'DELETE_0' ] ) ).to.eventually.equal( '<one>1</one>' ),
                expect( getFieldValue( q.get()[ 'DELETE_1' ] ) ).to.eventually.equal( '<a>a</a>' )
            ] );
        } );

    } );

    describe( 'queue manages submission failures and successes', () => {
        let q;
        let i;
        const failSubmitOne = () => Promise.reject( new Error( 'Error: 400' ) );
        const succeedSubmitOne = () => Promise.resolve( 201 );
        const succeedFailSubmitOne = () => {
            i++;
            return ( i % 2 === 0 ) ? failSubmitOne() : succeedSubmitOne();
        };

        beforeEach( () => {
            i = 0;
            q = new FieldSubmissionQueue();
            q.addFieldSubmission( p1, '1', id );
            q.addFieldSubmission( p2, 'a', id );
        } );

        it( 'removes a queue item if submission was successful', () => {
            q._submitOne = succeedSubmitOne;

            const updatedQueueKeys = q.submitAll()
                .then( results => Object.keys( q.get() ) );
            return expect( updatedQueueKeys ).to.eventually.deep.equal( [] );
        } );

        it( 'ignores new fieldsubmissions if they are the same as the last for that field', () => {
            q._submitOne = succeedSubmitOne;

            const updatedQueueKeys = q.submitAll()
                .then( results => {
                    q.addFieldSubmission( p1, '1', id );
                    q.addFieldSubmission( p2, 'a', id );
                    return Object.keys( q.get() );
                } );
            return expect( updatedQueueKeys ).to.eventually.deep.equal( [] );
        } );

        it( 'retains a queue item if submission failed', () => {
            q._submitOne = failSubmitOne;

            const updatedQueueKeys = q.submitAll()
                .then( results => Object.keys( q.get() ) );
            return expect( updatedQueueKeys ).to.eventually.deep.equal( [ `POST_${p1}`, `POST_${p2}` ] );
        } );

        it( 'retains a queue item if submission failed', () => {
            q._submitOne = succeedFailSubmitOne;

            const updatedQueueKeys = q.submitAll()
                .then( results => Object.keys( q.get() ) );
            return expect( updatedQueueKeys ).to.eventually.deep.equal( [ `POST_${p2}` ] );
        } );

        it( 'if a field is updated during a failing submission attempt, ' +
            'the old field submission will not be retained in the queue',
            () => {
                q._submitOne = succeedFailSubmitOne;

                const updatedQueue = q.submitAll()
                    .then( results => q.get() );
                // this will complete before updatedQueueKeys is resolved!
                q.addFieldSubmission( p2, 'b', id );

                return Promise.all( [
                    expect( updatedQueue ).to.eventually.have.property( `POST_${p2}` ),
                    expect( updatedQueue.then( q => getFieldValue( q[ `POST_${p2}` ] ) ) ).to.eventually.equal( 'b' ),
                    expect( updatedQueue ).to.eventually.not.have.property( `POST_${p1}` )
                ] );
            } );
    } );

    // TODO
    // * timeout


} );
