export class SourcePage {
    static visit() {
        cy.get('a[title=Source]', {timeout: 15000}).click();
        cy.hash().should('be', '#/source')
    }

    /**
     * @Param {string} sourceType
     */
    static setMigrationSource(sourceType) {
        cy.get('select[name=migrationSource]').select(sourceType);
    }

    static getTenantUrlInput() {
        return cy.get('input[name=tenantUrl]')
    }

    static getUsernameInput() {
        return cy.get('input[name=username]')
    }

    static getPasswordInput() {
        return cy.get('input[name=password]', { log: false })
    }

    static checkConnection() {
        cy.get('c8y-action-bar').contains('button', 'Check connection').click();
    }
}
