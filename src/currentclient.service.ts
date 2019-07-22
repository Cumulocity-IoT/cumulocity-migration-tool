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
import {AlarmService, ApplicationService, AuditService, FetchClient, DeviceRegistrationService,
    DeviceRegistrationBulkService,
    EventService,
    InventoryRoleService,
    InventoryService,
    InventoryBinaryService,
    MeasurementService,
    OperationService,
    OperationBulkService,
    TenantSecurityOptionsService,
    TenantOptionsService,
    SystemOptionsService,
    Realtime,
    UserRoleService,
    UserGroupService,
    UserService,
    TenantService} from "@c8y/client";

export interface ClientLike {
    alarm: AlarmService;
    application: ApplicationService;
    audit: AuditService;
    core: FetchClient;
    deviceRegistration: DeviceRegistrationService;
    deviceRegistrationBulk: DeviceRegistrationBulkService;
    event: EventService;
    inventory: InventoryService;
    inventoryRole: InventoryRoleService;
    inventoryBinary: InventoryBinaryService;
    measurement: MeasurementService;
    operation: OperationService;
    operationBulk: OperationBulkService;
    options: {
        security: TenantSecurityOptionsService;
        system: SystemOptionsService;
        tenant: TenantOptionsService;
    };
    realtime: Realtime;
    role: InventoryRoleService;
    tenant: TenantService;
    user: UserService;
    userGroup: UserGroupService;
    userRole: UserRoleService;
}

export function currentTenantClientFactory (
    alarm: AlarmService,
    application: ApplicationService,
    audit: AuditService,
    core: FetchClient,
    deviceRegistration: DeviceRegistrationService,
    deviceRegistrationBulk: DeviceRegistrationBulkService,
    event: EventService,
    inventory: InventoryService,
    inventoryRole: InventoryRoleService,
    inventoryBinary: InventoryBinaryService,
    measurement: MeasurementService,
    operation: OperationService,
    operationBulk: OperationBulkService,
    options_security: TenantSecurityOptionsService,
    options_system: SystemOptionsService,
    options_tenant: TenantOptionsService,
    realtime: Realtime,
    role: InventoryRoleService,
    tenant: TenantService,
    user: UserService,
    userGroup: UserGroupService,
    userRole: UserRoleService
): ClientLike {
    return {
        alarm: alarm,
        application: application,
        audit: audit,
        core: core,
        deviceRegistration: deviceRegistration,
        deviceRegistrationBulk: deviceRegistrationBulk,
        event: event,
        inventory: inventory,
        inventoryRole: inventoryRole,
        inventoryBinary: inventoryBinary,
        measurement: measurement,
        operation: operation,
        operationBulk: operationBulk,
        options: {
            security: options_security,
            system: options_system,
            tenant: options_tenant,
        },
        realtime: realtime,
        role: role,
        tenant: tenant,
        user: user,
        userGroup: userGroup,
        userRole: userRole,
    }
}