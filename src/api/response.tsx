import axios, {AxiosError, AxiosResponse } from 'axios';
export function handleResponse(response: AxiosResponse) {
    if (response.data) {
        return response.data;
    }
    return response;
}

// The JSON body of an error response, or undefined if there isn't one. A body that isn't JSON
// (e.g. an HTML error page) is ignored, since a plain string would look like a successful
// response to callers that expect text.
const json_payload = (error: AxiosError): object | undefined => {
    let data: unknown = error.response?.data
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data)
        } catch {
            return undefined
        }
    }
    return data != null && typeof data === 'object' ? data : undefined
}

export function handleError(error: Error | AxiosError) {
    if (axios.isAxiosError(error)) {
        // Any error response may carry the server's explanation in its JSON body. Prefer its
        // `details`, wrapped in an Error so callers can't mistake it for a successful text
        // response; otherwise pass on the whole payload, then the generic axios error.
        const payload = json_payload(error)
        const details = (payload as { details?: unknown } | undefined)?.details
        if (details != null && details !== '') {
            return new Error(typeof details === 'string' ? details : JSON.stringify(details))
        }
        if (payload) return details ?? payload
        return error.toJSON();
    }
    return error;
}

export function intResponse( response: AxiosResponse ) {
    //do somthing with response data
   return response 
}

export function intError(error: AxiosError) {
    //do somthing with error data
    console.error('intError', error)
    const status = error.response?.status
    if (status === 400) {
        console.error('interceptor error detail', error)
    }
    else if (status === 401) {
        console.error('Authentication error')
    }
    else if (status === 404) {
        console.error('404 error. API not found')
    }
    else { 
        console.error(error.message)
    }

    return Promise.reject(error) // send axios error
}
