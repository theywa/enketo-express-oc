// Modify the Enketo Core calculation module.

import calculationModule from 'enketo-core/src/js/calculate';

calculationModule._originalUpdateCalc = calculationModule._updateCalc;

calculationModule._updateCalc = function( control, props, emptyNonRelevant ){
    // OC customization, always empty (and not re-calculate) if not relevant
    emptyNonRelevant = true;

    return this._originalUpdateCalc( control, props, emptyNonRelevant );
};

export default calculationModule;
