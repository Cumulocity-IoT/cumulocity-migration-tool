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