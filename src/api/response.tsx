import axios, {AxiosError, AxiosResponse } from 'axios';
export function handleResponse(response: AxiosResponse) {
    if (response.data) {
        return response.data;
    }
    return response;
}

export function handleError(error: Error | AxiosError) {
    if (axios.isAxiosError(error)) {
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
