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
import {Inject, Injectable} from "@angular/core";
import {ClientLike} from "./currentclient.service";
import {Client, BasicAuth} from "@c8y/client";
import {CredentialsService, IConnectionDetails} from "./credentials.service";
import {getValueSync} from "./utils/utils";
import {map, shareReplay} from "rxjs/operators";
import {Observable} from "rxjs";
import {HttpDataClient} from "./HttpDataClient";
import {FileDataClient} from "./FileDataClient";
import {DataClient} from "./DataClient";

@Injectable({providedIn: 'root'})
export class DataService {
    sourceDataClient$: Observable<DataClient>;
    destinationDataClient$: Observable<DataClient>;

    currentClientDataClient: DataClient;

    constructor(private credentialsService: CredentialsService, @Inject('currentClient') private currentClient: ClientLike) {
        this.currentClientDataClient = new HttpDataClient(this.currentClient);

        this.sourceDataClient$ = this.credentialsService.source$
            .pipe(map((connection) => this.createDataClient(connection)), shareReplay(1));
        this.destinationDataClient$ = this.credentialsService.destination$
            .pipe(map((connection) => this.createDataClient(connection)), shareReplay(1));
    }

    createDataClient(connection: IConnectionDetails): DataClient {
        switch(connection.type) {
            case 'currentTenant':
                return this.currentClientDataClient;
            case 'tenant':
                return new HttpDataClient(new Client(new BasicAuth(connection.credentials), connection.baseUrl));
            case 'file':
                return new FileDataClient(connection.file, connection.fileName);
        }
    }

    getSourceDataClient(): DataClient {
        return getValueSync(this.sourceDataClient$);
    }
    getDestinationDataClient(): DataClient {
        return getValueSync(this.destinationDataClient$);
    }
}