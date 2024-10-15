import axios from 'axios';

import { handleResponse, handleError, intResponse, intError } from './response.tsx';
import { Target } from '../App.tsx';
const SIMBAD_ADDR = "https://simbad.u-strasbg.fr/simbad/sim-id?NbIdent=1&submit=submit+id&output.format=ASCII&obj.bibsel=off&Ident="
const BASE_URL = "http://carby:45682"


export interface UserInfo {
    status: string;
    Id: number;
    Title: string;
    FirstName: string;
    MiddleName: string;
    LastName: string;
    Email: string;
    Affiliation: string;
    WorkArea: string;
    Interests: string;
    Street: string;
    City: string;
    State: string;
    Country: string;
    Zip: string;
    Phone: string;
    Fax: string;
    URL: string;
    ModDate: string;
    Exposed: string;
    username: string;
    resetcode: number;
    AllocInst: string;
    BadEmail: string;
    Category: string;
}


const axiosInstance = axios.create({
    withCredentials: false,
    headers: {
        'Content-Type': 'application/json',
        'withCredentials': false,
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
    const url = "/userinfo"
    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
}

export const delete_target = (target_ids: string[]): Promise<string> => {
    const url = BASE_URL + "/planning_tool/deleteTarget?"
    return axiosInstance.put(url, target_ids)
        .then(handleResponse)
        .catch(handleError)
}

export const get_targets = (obsid?: number, target_id?: string): Promise<Target[]> => {
    let url = BASE_URL + "/planning_tool/getTarget?"
    url += obsid ? "obsid=" + obsid: ""
    url += target_id ? "&target_id=" + target_id: ""

    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
}

export interface SubmitTargetResponse {
    targets: Target[] 
    errors: string[] 
}

export const submit_target = (targets: Target[]): Promise<SubmitTargetResponse> => {
    const url = BASE_URL + "/planning_tool/submitTarget"
    return axiosInstance.post(url, targets)
        .then(handleResponse)
        .catch(handleError)
}

