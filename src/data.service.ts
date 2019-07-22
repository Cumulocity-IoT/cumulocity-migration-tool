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