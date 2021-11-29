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
import { Injectable } from "@angular/core";
import { ICredentials } from "@c8y/client";
import { BehaviorSubject } from "rxjs";

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

@Injectable({ providedIn: 'root' })
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

    public getErrorMessage(connectionDetails: IConnectionDetails): string {
        if (connectionDetails.type === 'file') {
            return this.getErrorMessageForFileConnection();
        } else if (connectionDetails.type === 'currentTenant') {
            return this.getErrorMessageForCurrentTenant();
        } else if (connectionDetails.type === 'tenant') {
            return this.getErrorMessageForTenant((connectionDetails as ITenantConnectionDetails).baseUrl);
        }

        return this.getErrorMessageForCurrentTenant();
    }

    private getErrorMessageForFileConnection(): string {
        return `<h4 class="alert-heading">Cannot access the server</h4>
        <br />
        The cause may be one of the following: <br />
        <ul>
            <li>The server is not responding</li>
        </ul>`;
    }

    private getErrorMessageForCurrentTenant(): string {
        return `<h4 class="alert-heading">Cannot access the server</h4>
        <br />
        The cause may be one of the following: <br />
        <ul>
            <li>The server is not responding</li>
        </ul>`;
    }

    private getErrorMessageForTenant(baseUrl: string): string {
        return `<h4 class="alert-heading">Cannot access the server</h4>
        <br />
        The cause may be one of the following: <br />
        <ul>
            <li>The server is not responding</li>
            <li>Credentials are incorrect</li>
            <li>CORS is not setup on the server</li>
        </ul>
        <br />
        To fix the CORS errors:<br />
        Temporarily set <a
            href="${baseUrl}/apps/administration/index.html#/applicationsettings"
            target="_blank">Access control, Allowed Domain</a> to <code>*</code> (Requires tenant Admin
        access)<br />`;
    }
}