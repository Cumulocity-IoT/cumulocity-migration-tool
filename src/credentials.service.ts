/*
* Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
*
* SPDX-License-Identifier: Apache-2.0
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
 */
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