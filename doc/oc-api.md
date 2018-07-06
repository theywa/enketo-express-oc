## OpenClinica API

OpenClinica is using its own custom Enketo API at **/oc/api/v1** and has disabled the default Enketo Express API at /api/v2. This was done to create a cleaner, less verbose API for all views used by OC, including ones that submit data to [OpenClinica's Fieldsubmission API](https://swaggerhub.com/api/martijnr/openclinica-fieldsubmission) instead of the regular OpenRosa Submission API.

### Authentication for all /oc/api/v1/.. requests

Api authentication is done via a Authorization header using the well-known [Basic Authentication Scheme](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication) with the API key as username and an empty string as password (over https always).

### Responses for all /oc/api/v1/.. requests

A successful **POST** response (always has `url` property) with 200 or 201 HTTP status. The code is identical to the HTTP statuscode of the response. It is recommended to check the HTTP statuscode (and ignore the body code).

```xml
{
    "url": "https://enke.to/preview/::abcd",
    "code": 200
}
```

A successful 204 **DELETE** response is an empty body with the 204 HTTP status. 

Explanation of all statuscodes:

* 201: Record was created, request succeeded.
* 200: Record existed, request succeeded.
* 204: Request succeeded, empty response.
* 400: Malformed request, maybe parameters are missing.
* 401: Authentication failed, incorrect or expired API token used or none at all.
* 403: Authentication succeeded, but account is not active or quota is filled up.
* 404: Resource was not found in database.
* 405: Request not allowed. This endpoint may be disabled or not implemented.
* 410: This API endpoint is deprecated in this version.

### POST|GET /version

Returns a JSON object with a version property. No authentication required. No parameters supported.

### POST /survey/collect

Returns a url that points to an iframe-friendly regular fieldsubmission view. No close button present in the Discrepancy Note Widget.

Use exactly as [POST /survey/single](http://apidocs.enketo.org/v2/#/post-survey-single)

### POST /survey/collect/c

Same as POST /survey/collect except this view has a **Close button** in the Discrepancy Note Widget.

### POST /survey/view

Returns a url that points to an iframe-friendly **empty readonly** form.

Has an optional `load_warning` parameter for a string value to be displayed in a modal dialog upon load.
Has an optional `go_to_error_url` parameter that in conjunction with `go_to` will prompt the user to redirect to a _mini form_ if the go_to target is not available or hidden.

Otherwise exactly as [POST /survey/view](http://apidocs.enketo.org/v2/#/post-survey-view)

### POST /survey/view/pdf

Returns a PDF of an empty form or a JSON error response.

Use exactly as [POST /survey/view/pdf](https://apidocs.enketo.org/v2#/post-survey-view-pdf)

### POST /survey/preview

Returns a url that points to an iframe-friendly **empty** form.

Has an optional `go_to_error_url` parameter that in conjunction with `go_to` will prompt the user to redirect to a _mini form_ if the go_to target is not available or hidden.

Otherwise exactly as [POST /survey/preview](http://apidocs.enketo.org/v2/#/post-survey-preview)

### DELETE /survey/cache

Remove the cached survey transformation results from Enketo. To be used when an already-launched XForm has been edited and is re-published. Highly recommended to use this only when necessary to avoid severe loading performance degradation.

Use exactly as [DELETE /survey/cache](https://apidocs.enketo.org/v2#/delete-survey-cache)

### POST /instance/edit

Returns a url that points to a regular webform fieldsubmission view with an **existing record**. No Close button present in the Discrepancy Note Widget.

Has an optional `go_to_error_url` parameter that in conjunction with `go_to` will prompt the user to redirect to a _mini form_ if the go_to target is not available or hidden.

Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button. \[**THIS WILL BE REMOVED**\]

Otherwise, use exactly as [POST /instance](http://apidocs.enketo.org/v2/#/post-instance)

### POST /instance/edit/c

Same as POST /instance/edit except that this view has a **Close button** in the Discrepancy Note Widget.

Has an optional `go_to_error_url` parameter that in conjunction with `go_to` will prompt the user to redirect to a _mini form_ if the go_to target is not available or hidden.

### POST /instance/edit/rfc 

Returns a url that points to webform fieldsubmission view with an existing record **and a reason-for-change UI**. No Close button present in the Discrepancy Note widget.

Has an optional `go_to_error_url` parameter that in conjunction with `go_to` will prompt the user to redirect to a _mini form_ if the go_to target is not available or hidden.

Use exactly as [POST /instance](http://apidocs.enketo.org/v2/#/post-instance)

### POST /instance/edit/rfc/c 

Same as POST /instance/edit/rfc except that this view has a **Close button** in the Discrepancy Note Widget.

### POST /instance/view

Returns a url that points to a **readonly** form with a record loaded into it.

Has an optional `load_warning` parameter for a string value to be displayed in a modal dialog upon load.

Has an optional `go_to_error_url` parameter that in conjunction with `go_to` will prompt the user to redirect to a _mini form_ if the go_to target is not available or hidden.

Otherwise exactly as [POST /instance/view](https://apidocs.enketo.org/v2#/post-instance-view)

### POST /instance/view/pdf

Returns a PDF of a form with a record loaded into it or a JSON error response.

Use exactly as [POST /instance/view/pdf](https://apidocs.enketo.org/v2#/post-instance-view-pdf)

### POST /instance/note

Returns a url that points to a readonly view of an existing record where **only the discrepancy notes widgets are enabled**, and the discrepancy notes widgets **do not have** a Close button.

Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines 
whether a _Complete_ button is present below the form in addition to the always-present _Close_ button. \[**THIS WILL BE REMOVED**\]

Has an optional `load_warning` parameter for a string value to be displayed in a modal dialog upon load.

Has an optional `go_to_error_url` parameter that in conjunction with `go_to` will prompt the user to redirect to a _mini form_ if the go_to target is not available or hidden.

Otherwise, use exactly as [POST /instance/view](https://apidocs.enketo.org/v2#/post-instance-view)

### POST /instance/note/c

Same as POST /instance/note except that this view has a **Close button** in the Discrepancy Note Widget.

### DELETE /instance

Removes cached instance. This method may not have a practical use as instances POSTed to enketo for editing are only cached/saved very briefly (available for a maximum of 1 minute).

Use exactly as [DELETE /instance](https://apidocs.enketo.org/v2#/delete-instance)

