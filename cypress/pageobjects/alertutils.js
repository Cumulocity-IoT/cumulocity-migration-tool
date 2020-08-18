export class AlertUtils {
    static assertNoAlerts() {
        cy.get('c8y-alert-outlet .alert').should('not.exist');
    }
}
