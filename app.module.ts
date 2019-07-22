import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { ExampleNavigationFactory } from './factories/Navigation';
import { ApplicationComponent } from './src/source/application/application.component';
import {
    CommonModule,
    CoreModule,
    HOOK_NAVIGATOR_NODES,
    BootstrapComponent
} from '@c8y/ngx-components';
import {FormsModule} from "@angular/forms";
import {FileSizePipe} from "./src/pipes/filesize.pipe";
import {CredentialsComponent as SourceCredentialsComponent} from "./src/source/credentials/credentials.component";
import {CredentialsComponent as DestinationCredentialsComponent} from "./src/destination/credentials/credentials.component";
import {CredentialsService} from "./src/credentials.service";
import {CredentialsGuard as SourceCredentialsGuard} from "./src/source/credentials.guard";
import {CredentialsGuard as DestinationCredentialsGuard} from "./src/destination/credentials.guard";
import {CredentialsGuard as MigrateCredentialsGuard} from "./src/migrate/credentials.guard";
import {DataService} from "./src/data.service";
import {DashboardComponent} from "./src/source/dashboard/dashboard.component";
import {GroupComponent} from "./src/source/group/group.component";
import {DeviceComponent} from "./src/source/device/device.component";
import {TenantLoginComponent} from "./src/tenantlogin/tenantlogin.component";
import {MigrateComponent} from "./src/migrate/migrate.component";
import {MainComponent} from "./src/main/main.component";
import { ButtonsModule } from 'ngx-bootstrap/buttons';
import {currentTenantClientFactory} from "./src/currentclient.service";
import {AlarmService, ApplicationService, FetchClient, AuditService, EventService, InventoryService, InventoryRoleService,
    InventoryBinaryService,
    MeasurementService,
    OperationService,
    OperationBulkService,
    DeviceRegistrationService,
    TenantSecurityOptionsService,
    SystemOptionsService,
    Realtime,
    TenantService,
    UserService,
    UserGroupService,
    UserRoleService,
    TenantOptionsService,
    DeviceRegistrationBulkService} from '@c8y/client';
import {OtherComponent} from "./src/source/other/other.component";
import {SimulatorComponent} from "./src/source/simulator/simulator.component";
import {SmartRuleComponent} from "./src/source/smartrule/smart-rule.component";
import {LandingPageComponent} from "./src/landingpage/landing-page.component";
import {ModalModule} from "ngx-bootstrap/modal";
import {SelectDeviceComponent} from "./src/migrate/selectdevice/select-device.component";
import {MigrateLeaveGuard} from "./src/migrate/migrate-leave.guard";
import {BinaryComponent} from "./src/source/binary/binary.component";
import {SelectGroupComponent} from "./src/migrate/selectgroup/select-group.component";
import {SelectOtherComponent} from "./src/migrate/selectother/select-other.component";
import {SelectDashboardComponent} from "./src/migrate/selectdashboard/select-dashboard.component";
import {SelectApplicationComponent} from "./src/migrate/selectapplication/select-application.component";
import {SelectSimulatorComponent} from "./src/migrate/selectsimulator/select-simulator.component";
import {SelectSmartRuleComponent} from "./src/migrate/selectsmartrule/select-smart-rule.component";
import {SelectBinaryComponent} from "./src/migrate/selectbinary/select-binary.component";

/**
 * Angular Routes.
 * Within this array at least path (url) and components are linked.
 */
const appRoutes: Routes = [
    {
        path: '',
        component: MainComponent,
        children: [
            {
                path: 'home',
                component: LandingPageComponent,
            }, {
                path: 'source',
                component: SourceCredentialsComponent,
            }, {
                path: 'source/application',
                component: ApplicationComponent,
                canActivate: [SourceCredentialsGuard]
            }, {
                path: 'source/dashboard',
                component: DashboardComponent,
                canActivate: [SourceCredentialsGuard]
            }, {
                path: 'source/group',
                component: GroupComponent,
                canActivate: [SourceCredentialsGuard]
            }, {
                path: 'source/device',
                component: DeviceComponent,
                canActivate: [SourceCredentialsGuard]
            }, {
                path: 'source/simulator',
                component: SimulatorComponent,
                canActivate: [SourceCredentialsGuard]
            }, {
                path: 'source/smartrule',
                component: SmartRuleComponent,
                canActivate: [SourceCredentialsGuard]
            },{
                path: 'source/binary',
                component: BinaryComponent,
                canActivate: [SourceCredentialsGuard]
            }, {
                path: 'source/other',
                component: OtherComponent,
                canActivate: [SourceCredentialsGuard]
            }, {
                path: 'destination',
                component: DestinationCredentialsComponent
            }, {
                path: 'migrate',
                component: MigrateComponent,
                canActivate: [MigrateCredentialsGuard],
                canDeactivate: [MigrateLeaveGuard]
            }, {
                path: '',
                redirectTo: 'home',
                pathMatch: 'full'
            }
        ]
    }
];

@NgModule({
    declarations: [
        MainComponent,
        LandingPageComponent,
        TenantLoginComponent,
        SourceCredentialsComponent,
        DestinationCredentialsComponent,
        ApplicationComponent,
        DashboardComponent,
        GroupComponent,
        DeviceComponent,
        SimulatorComponent,
        SmartRuleComponent,
        BinaryComponent,
        OtherComponent,
        MigrateComponent,
        SelectDeviceComponent,
        FileSizePipe,
        SelectGroupComponent,
        SelectOtherComponent,
        SelectDashboardComponent,
        SelectApplicationComponent,
        SelectSimulatorComponent,
        SelectSmartRuleComponent,
        SelectBinaryComponent
    ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(appRoutes, { enableTracing: false, useHash: true }),
    // Import the CoreModule to allow use of the `c8y-` prefixed components
    CoreModule,
    // Import the CommonModule to allow use of data access and translations
    CommonModule,
    FormsModule,
    ButtonsModule.forRoot(),
    ModalModule.forRoot()
  ],
  /**
   * Use our predefined InjectionTokens and provide your own classes to extend behaviour
   * and functionality of existing ones. Implement your own NavigationNodes, Tabs, Actions and Breadcrumbs
   */
  providers: [
    DataService,
    CredentialsService,
    { provide: HOOK_NAVIGATOR_NODES, useClass: ExampleNavigationFactory, multi: true},
    { provide: 'currentClient', useFactory: currentTenantClientFactory, deps: [
        AlarmService,
        ApplicationService,
        AuditService,
        FetchClient,
        DeviceRegistrationService,
        DeviceRegistrationBulkService,
        EventService,
        InventoryService,
        InventoryRoleService,
        InventoryBinaryService,
        MeasurementService,
        OperationService,
        OperationBulkService,
        TenantSecurityOptionsService,
        SystemOptionsService,
        TenantOptionsService,
        Realtime,
        InventoryRoleService,
        TenantService,
        UserService,
        UserGroupService,
        UserRoleService
    ]}
  ],
  /**
   * Bootstrap your application with the BootstrapComponent which will use the `<c8y-bootstrap>`
   * component to initialize the root application. Alternatively you can bootstrap
   * a component of your choice and include that tag into its template or only reuse the given components
   */
  bootstrap: [BootstrapComponent]
})
export class AppModule { }
