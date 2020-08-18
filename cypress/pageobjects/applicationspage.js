export class ApplicationsPage {
    static visit() {
        cy.get('a[title=Applications]', {timeout: 15000}).click();
        cy.hash().should('be', '#/source/application');
    }
}
