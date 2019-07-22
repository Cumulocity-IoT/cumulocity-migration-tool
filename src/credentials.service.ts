import {Injectable} from "@angular/core";
import {ICredentials} from "@c8y/client";
import {BehaviorSubject} from "rxjs";

export interface ICurrentTenantConnectionDetails {
    type: 'currentTenant'
}

export interface ITenantConnectionDetails {
    type: 'tenant',
    credentials: ICredentials,
    baseUrl: string
}

export interface IFileConnectionDetails {
    type: 'file'
    file: Blob,
    fileName: string
}

export type IConnectionDetails = ICurrentTenantConnectionDetails | ITenantConnectionDetails | IFileConnectionDetails;

@Injectable({providedIn: 'root'})
export class CredentialsService {
    source$ = new BehaviorSubject<IConnectionDetails>({
        type: 'currentTenant',
        credentials: {},
        baseUrl: 'https://TenantName.cumulocity.com'
    } as ICurrentTenantConnectionDetails);
    destination$ = new BehaviorSubject<IConnectionDetails>({
        type: 'file',
        file: undefined,
        credentials: {},
        baseUrl: 'https://TenantName.cumulocity.com',
        fileName: 'CumulocityMigrationToolExport.zip'
    } as IFileConnectionDetails);
}