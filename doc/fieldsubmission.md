## Fieldsubmission Webform view

There are special fieldsubmission webform views that submit data to [OpenClinica's Fieldsubmission API](https://swaggerhub.com/api/martijnr/openclinica-fieldsubmission) instead of the regular OpenRosa Submission API.

**Make sure to enable the ['ordinals' feature](./ordinals.md) because the fieldsubmission feature requires this for forms that contain repeats.**

The following custom Enketo API endpoints return a fieldsubmission webform view:

### GET /survey/single/fieldsubmission
Has an optional `dn_close_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"true"`. This parameter determines 
whether a _Close_ button is present in the _Discrepancy Notes widget_.

Only use for testing, use as [GET /survey/single](http://apidocs.enketo.org/v2/#/get-survey-single)*

### GET /survey/single/fieldsubmission/iframe 
Has an optional `dn_close_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"true"`. This parameter determines 
whether a _Close_ button is present in the _Discrepancy Notes widget_.

Only use for testing, use as [GET /survey/single/iframe](http://apidocs.enketo.org/v2/#/get-survey-single-iframe)*

### POST /survey/single/fieldsubmission
Has an optional `dn_close_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"true"`. This parameter determines 
whether a _Close_ button is present in the _Discrepancy Notes widget_.

Otherwise, use exactly as [POST /survey/single](http://apidocs.enketo.org/v2/#/post-survey-single)*

### POST /survey/single/fieldsubmission/iframe
Has an optional `dn_close_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"true"`. This parameter determines 
whether a _Close_ button is present in the _Discrepancy Notes widget_.

Otherwise, use exactly as [POST /survey/single/iframe](http://apidocs.enketo.org/v2/#/post-survey-single-iframe)*

### POST /instance/fieldsubmission
Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines whether a _Complete_ button is present below the form in addition to the always-present _Close_ button.

Has an optional `dn_close_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"true"`. This parameter determines 
whether a _Close_ button is present in the _Discrepancy Notes widget_.

Has an optional `reason_for_change` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines whether the user is required to enter a reason for change.

Otherwise, use exactly as [POST /instance](http://apidocs.enketo.org/v2/#/post-instance)*

### POST /instance/fieldsubmission/iframe
Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button.

Has an optional `dn_close_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"true"`. This parameter determines 
whether a _Close_ button is present in the _Discrepancy Notes widget_.

Has an optional `reason_for_change` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines whether the user is required to enter a reason for change.

Otherwise, use exactly as [POST /instance/iframe](http://apidocs.enketo.org/v2/#/post-instance-iframe)*

\* The API `defaults` request parameter is not implemented. The response property name will differ. E.g. GET /survey/single/fieldsubmission will return ‘single_fieldsubmission_url’ instead of ‘single_url’.
