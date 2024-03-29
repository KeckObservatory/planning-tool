import axios from 'axios';

import { handleResponse, handleError, intResponse, intError } from './response.tsx';
const SIMBAD_ADDR = "https://simbad.u-strasbg.fr/simbad/sim-id?NbIdent=1&submit=submit+id&output.format=ASCII&obj.bibsel=off&Ident="


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