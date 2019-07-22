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
import {Alert, AlertService} from "@c8y/ngx-components";
import _ from "lodash";
import {delay} from "./utils";

export class UpdateableAlert {
    previousAlert: Alert;
    stop: boolean = false;
    public update: (msg: string, type?: 'success' | 'warning' | 'danger' | 'info' | 'system') => void = _.throttle(this._update, 500, { leading: true, trailing: true });

    constructor(private alertService: AlertService) {}

    private _update(msg: string, type?: 'success' | 'warning' | 'danger' | 'info' | 'system') {
        if (this.stop) return;
        if (this.previousAlert) {
            this.alertService.remove(this.previousAlert);
            type = type || this.previousAlert.type;
        }
        const alert = this.previousAlert = {
            text: msg,
            type: type || 'info',
            onClose: () => this._onClose()
        };
        this.alertService.add(alert);
    }

    private _onClose() {
        this.stop = true;
    }

    async close(timeout = 500) {
        await delay(timeout);
        this.stop = true;
        if (this.previousAlert) {
            this.alertService.remove(this.previousAlert);
        }
    }
}