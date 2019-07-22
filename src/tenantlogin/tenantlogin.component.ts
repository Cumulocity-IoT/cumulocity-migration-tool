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
import {Input, Component, Output, EventEmitter} from "@angular/core";

@Component({
    selector: 'mt-tenantlogin',
    templateUrl: './tenantlogin.component.html'
})
export class TenantLoginComponent {
    @Input() baseUrl: string;
    @Input() username: string;
    @Input() password: string;
    @Input() disabled: boolean;
    @Output() onChange = new EventEmitter<{baseUrl: string, username: string, password: string}>();

    changed() {
        if(this.onChange && !this.disabled) {
            this.onChange.emit({
                baseUrl: this.baseUrl,
                username: this.username,
                password: this.password
            })
        }
    }
}