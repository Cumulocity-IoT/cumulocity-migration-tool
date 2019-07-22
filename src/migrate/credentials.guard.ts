import { Injectable } from '@angular/core';
import {ActivatedRouteSnapshot, RouterStateSnapshot, Router, CanActivate} from '@angular/router';
import {AlertService} from "@c8y/ngx-components";
import {DataService} from "../data.service";

@Injectable({
    providedIn: 'root',
})
export class CredentialsGuard implements CanActivate {
    constructor(private dataService: DataService, private router: Router, private alertService: AlertService){}

    async canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
        try {
            await this.dataService.getSourceDataClient().getUser();
        } catch(e) {
            this.router.navigate(['/source']);
            this.alertService.danger('Unable to connect to server. Check connection details.');
            return false;
        }
        try {
            await this.dataService.getDestinationDataClient().getUser();
        } catch(e) {
            this.router.navigate(['/destination']);
            this.alertService.danger('Unable to connect to server. Check connection details.');
            return false;
        }
        return true;
    }
}