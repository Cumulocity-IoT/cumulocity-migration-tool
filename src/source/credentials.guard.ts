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
            return true;
        } catch(e) {
            this.router.navigate(['/source']);
            this.alertService.danger('Unable to connect to server. Check connection details.');
            return false;
        }
    }
}