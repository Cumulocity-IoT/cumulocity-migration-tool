import { Injectable } from '@angular/core';
import {CanDeactivate} from '@angular/router';
import {MigrateComponent} from "./migrate.component";

@Injectable({
    providedIn: 'root',
})
export class MigrateLeaveGuard implements CanDeactivate<MigrateComponent> {
    async canDeactivate(component: MigrateComponent) {
        if (component.dirty) {
            return confirm("Are you sure you want to leave? Any changes will be lost");
        } else {
            return true;
        }
    }
}