## Fieldsubmission Webform view

There are special fieldsubmission webform views that submit data to [OpenClinica's Fieldsubmission API](https://swaggerhub.com/api/martijnr/openclinica-fieldsubmission) instead of the regular OpenRosa Submission API.

**Make sure to enable the ['ordinals' feature](./ordinals.md) because the fieldsubmission feature requires this for forms that contain repeats.**

The following custom Enketo API endpoints return a fieldsubmission webform view:


### POST /survey/single/fieldsubmission/iframe

Returns `single_fieldsubmission_iframe_url` that points to a regular fieldsubmission view. No close button present in the Discrepancy Note Widget.

Use exactly as [POST /survey/single/iframe](http://apidocs.enketo.org/v2/#/post-survey-single-iframe)


### POST /survey/single/fieldsubmission/c/iframe

Same as POST /survey/single/fieldsubmission/iframe except this view has a Close button in the Discrepancy Note Widget.


### POST /instance/fieldsubmission/iframe

Returns an `edit_url` that points to a regular webform fieldsubmission view with an existing record. No close button present in the Discrepancy Note Widget.

Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button. \[**THIS WILL BE REMOVED**\]

Otherwise, use exactly as [POST /instance/iframe](http://apidocs.enketo.org/v2/#/post-instance-iframe)


### POST /instance/fieldsubmission/c/iframe/

Same as POST /instance/fieldsubmission/iframe except that this view has a Close button in the Discrepancy Note Widget.


### POST /instance/fieldsubmission/note/iframe

Returns an `edit_iframe_url` that points to a readonly view of an existing record where only the discrepancy notes widgets are enabled, and the discrepancy notes widgets **do not have** a Close button.

Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button. \[**THIS WILL BE REMOVED**\]

Otherwise, use exactly as [POST /instance/view/iframe](https://apidocs.enketo.org/v2#/post-instance-view-iframe)


### POST /instance/fieldsubmission/note/c/iframe

Same as POST /instance/fieldsubmission/note/iframe except that this view has a Close button in the Discrepancy Note Widget.
