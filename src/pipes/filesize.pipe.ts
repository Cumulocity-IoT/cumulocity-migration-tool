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
import {Pipe, PipeTransform} from "@angular/core";

@Pipe({name: 'fileSize'})
export class FileSizePipe implements PipeTransform {
    transform(value: number): string {
        switch(Math.floor(Math.log2(value)/10)) {
            case 0: {
                return value + ' B'
            }
            case 1: {
                return (value/Math.pow(2, 10)).toPrecision(3) + ' KiB'
            }
            case 2: {
                return (value/Math.pow(2, 20)).toPrecision(3) + ' MiB'
            }
            default: {
                return (value/Math.pow(2, 30)).toPrecision(3) + ' GiB'
            }
        }
    }
}