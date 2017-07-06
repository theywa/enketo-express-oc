## Fieldsubmission Webform view

There are special fieldsubmission webform views that submit data to [OpenClinica's Fieldsubmission API](https://swaggerhub.com/api/martijnr/openclinica-fieldsubmission) instead of the regular OpenRosa Submission API.

**Make sure to enable the ['ordinals' feature](./ordinals.md) because the fieldsubmission feature requires this for forms that contain repeats.**

The following custom Enketo API endpoints return a fieldsubmission webform view:


### POST /survey/single/fieldsubmission/iframe

Use exactly as [POST /survey/single/iframe](http://apidocs.enketo.org/v2/#/post-survey-single-iframe)


### POST /instance/fieldsubmission/iframe

Returns an `edit_url` that points to a full-fledged webform view with an existing record.

Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button.

Otherwise, use exactly as [POST /instance/iframe](http://apidocs.enketo.org/v2/#/post-instance-iframe)


### POST /instance/fieldsubmission/view/dn/iframe

Returns an `edit_iframe_url` that points to a readonly view of an existing record where only the discrepancy notes widgets are enabled, and the discrepancy notes widgets **do not have** a Close button.

Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button.

Otherwise, use exactly as [POST /instance/view/iframe](https://apidocs.enketo.org/v2#/post-instance-view-iframe)


### POST /instance/fieldsubmission/view/dnc/iframe

Returns an `edit_iframe_url` that points to a readonly view of an existing record where only the discrepancy notes widgets are enabled, and the discrepancy notes widgets **have** a Close button.

Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button.

Otherwise, use exactly as [POST /instance/view/iframe](https://apidocs.enketo.org/v2#/post-instance-view-iframe)

\* The API `defaults` request parameter is not implemented. The response property name will differ. E.g. POST /survey/single/fieldsubmission will return ‘single_fieldsubmission_iframe_url’ instead of ‘single_iframe_url’.
