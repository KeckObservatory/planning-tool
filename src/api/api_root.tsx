import axios from 'axios';
import Cookies from 'js-cookie'

import { handleResponse, handleError, intResponse, intError } from './response.tsx';
import { Target } from '../App.tsx';
const SIMBAD_ADDR = "https://simbad.u-strasbg.fr/simbad/sim-id?NbIdent=1&submit=submit+id&output.format=ASCII&obj.bibsel=off&Ident="
const BASE_URL = "https://vm-dev-appserver/api/proposals"


export interface UserInfo {
    Id: number;
    FirstName: string;
    LastName: string;
    Affiliation: string;
    AllocInst: string;
    is_admin?: boolean; //added by backend
}


const axiosInstance = axios.create({
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
})
axiosInstance.interceptors.response.use(intResponse, intError);

export interface GetLogsArgs {
    n_logs: number,
    loggername: string,
    minutes?: number,
    subsystem?: string,
    semid?: string,
    startdatetime?: string,
    enddatetime?: string,
    dateformat?: string
}

export const get_simbad = (obj: string): Promise<string> => {
    const url = SIMBAD_ADDR + obj
    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
}

export const get_userinfo = (): Promise<UserInfo> => {
    let url = BASE_URL + '/userinfo'
    const obsid_cookie = Cookies.get('observer')
    return axiosInstance.post(url, { obsid_cookie })
        .then(handleResponse)
        .catch(handleError)
}

export const delete_target = (target_ids: string[]): Promise<string> => {
    const url = BASE_URL + "/deletePlanningToolTarget"
    const obsid_cookie = Cookies.get('observer')
    return axiosInstance.put(url, {obsid_cookie, target_ids})
        .then(handleResponse)
        .catch(handleError)
}

export const get_targets = (obsid?: number, target_id?: string): Promise<Target[]> => {
    let url = BASE_URL + "/getPlanningToolTarget?"
    url += obsid ? "obsid=" + obsid: ""
    url += target_id ? "&target_id=" + target_id: ""
    const obsid_cookie = Cookies.get('observer')
    return axiosInstance.put(url, {obsid_cookie})
        .then(handleResponse)
        .catch(handleError)
}

export interface SubmitTargetResponse {
    targets: Target[] 
    errors: string[] 
}

export const submit_target = (targets: Target[]): Promise<SubmitTargetResponse> => {
    const url = BASE_URL + "/submitPlanningToolTarget"
    return axiosInstance.post(url, { targets } )
        .then(handleResponse)
        .catch(handleError)
}

