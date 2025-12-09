import axios from 'axios';

import { handleResponse, handleError, intResponse, intError } from './response.tsx';
import { Target } from '../App.tsx';
import { CatalogTarget } from '../guide_star/guide_star_dialog.tsx';
const SIMBAD_ADDR = "https://simbad.u-strasbg.fr/simbad/sim-id?NbIdent=1&submit=submit+id&output.format=ASCII&obj.bibsel=off&Ident="
const BASE_URL = "/api/planning_tool"
const SCHEDULE_URL = "/api/schedule"


export interface UserInfo {
    semids: any;
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

interface Schedule {
    Account: string,
    BaseInstrument: string,
    Comment: string | null,
    Date: string,
    EndTime: string,
    FractionOfNight: number,
    Institution: string,
    Instrument: string,
    Length: number,
    Location: string,
    ObsId: string,
    ObsType: string,
    Observers: string,
    ObservingStatus: string,
    PiEmail: string,
    PiFirstName: string,
    PiId: number,
    PiLastName: string,
    Principal: string,
    ProjCode: string,
    SchedId: number,
    Semester: string,
    StartTime: string,
    TelNr: number
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

export const get_schedule = (date: string, telnr: number): Promise<Schedule[]> => {
    const url = SCHEDULE_URL + `/getSchedule?date=${date}&telnr=${telnr}`
    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
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
    return axiosInstance.post(url, { })
        .then(handleResponse)
        .catch(handleError)
}

export const submit_target_to_starlist_dir = (formData: FormData): Promise<string> => {
    return axiosInstance.post(BASE_URL + '/writeToStarlistDirectory', formData, {
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
    return axiosInstance.put(url, { target_ids })
        .then(handleResponse)
        .catch(handleError)
}

export const observer_logout = (): Promise<string> => {
    const url = BASE_URL + "/logout"
    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
}

export const get_targets = (obsid?: number, target_id?: string, semid?: string): Promise<Target[]> => {
    let url = BASE_URL + "/getPlanningToolTarget?"
    url += obsid ? "obsid=" + obsid : ""
    url += target_id ? "&target_id=" + target_id : ""
    url += semid ? "&semid=" + semid : ""
    return axiosInstance.get(url, { })
        .then(handleResponse)
        .catch(handleError)
}

export const get_catalog_targets = (catalog_name: string, ra: number, dec: number, radius: number): Promise<CatalogTarget[]> => {
    let url = `https://vm-appserver.keck.hawaii.edu/catalogs-test/sources/?position=%7B%22ra%22:${ra},%22dec%22:${dec}%7D&radius=${radius}&window-size=%7B%22size%22:${radius},%22units%22:%22degrees%22%7D&catalog=${catalog_name}&external=1`
    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
}

export const get_catalogs = (): Promise<string[]> => {
    let url = `https://vm-appserver.keck.hawaii.edu/catalogs-test/available/source`
    return axiosInstance.get(url)
        .then(handleResponse)
        .catch(handleError)
}

export interface SubmitTargetResponse {
    targets: Target[]
    errors: string[]
}

export const submit_target = (targets: Target[]): Promise<SubmitTargetResponse> => {
    const url = BASE_URL + "/submitPlanningToolTarget"
    return axiosInstance.post(url, { targets })
        .then(handleResponse)
        .catch(handleError)
}

