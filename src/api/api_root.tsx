import axios from 'axios';
import Cookies from 'js-cookie'

import { handleResponse, handleError, intResponse, intError } from './response.tsx';
import { Target } from '../App.tsx';
const SIMBAD_ADDR = "https://simbad.u-strasbg.fr/simbad/sim-id?NbIdent=1&submit=submit+id&output.format=ASCII&obj.bibsel=off&Ident="
const BASE_URL = "/api/planning_tool"


export interface UserInfo {
    Id: number;
    FirstName: string;
    LastName: string;
    Affiliation: string;
    AllocInst: string;
    is_admin?: boolean; //added by backend
}

export interface GaiaParams {
    ra_deg?: number,
    dec_deg?: number,
    parallax?: number,
    systemic_velocity?: number,
    g_mag?: number,
    t_eff?: number,
}

export interface GaiaResp {
    success: string,
    message: string,
    gaia_id: string,
    details?: string,
    gaia_params?: GaiaParams
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

export const get_gaia = (gaia_id: string): Promise<GaiaResp> => {
    const url = BASE_URL + `/getGaiaParameters?gaia_id=${gaia_id}`
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

export const submit_target_to_starlist_dir = (blob: Blob): Promise<string> => {
    return axiosInstance.post(BASE_URL + '/uploadStarlistToDir', blob, {
        headers: {
            'Content-Type': 'application/octet-stream',
        }
    }).then(handleResponse)
    .catch(handleError)
}

export interface DeleteResponse {
    status: string
}

export const delete_target = (target_ids: string[]): Promise<DeleteResponse> => {
    const url = BASE_URL + "/deletePlanningToolTarget"
    const obsid_cookie = Cookies.get('observer')
    return axiosInstance.put(url, { obsid_cookie, target_ids })
        .then(handleResponse)
        .catch(handleError)
}

export const observer_logout = (): Promise<string> => {
    const url = BASE_URL + "/logout"
    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
}

export const get_targets = (obsid?: number, target_id?: string): Promise<Target[]> => {
    let url = BASE_URL + "/getPlanningToolTarget?"
    url += obsid ? "obsid=" + obsid : ""
    url += target_id ? "&target_id=" + target_id : ""
    const obsid_cookie = Cookies.get('observer')
    return axiosInstance.put(url, { obsid_cookie })
        .then(handleResponse)
        .catch(handleError)
}

export interface SubmitTargetResponse {
    targets: Target[]
    errors: string[]
}

export const submit_target = (targets: Target[]): Promise<SubmitTargetResponse> => {
    const url = BASE_URL + "/submitPlanningToolTarget"
    const obsid_cookie = Cookies.get('observer')
    return axiosInstance.post(url, { targets, obsid_cookie })
        .then(handleResponse)
        .catch(handleError)
}

