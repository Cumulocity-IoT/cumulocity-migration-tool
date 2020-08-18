const { LoginPage } = require('../pageobjects/loginpage');
const { SourcePage } = require('../pageobjects/sourcepage');
const { AlertUtils } = require('../pageobjects/alertutils');
const { ApplicationsPage } = require('../pageobjects/applicationspage');

describe('My First Test', function() {
    const tenants = [
        {
            url: 'http://localhost:9000',
            id: 'industrysolutions',
            username: 'richard.peach@softwareag.com',
            password: 'ygWaV6Emuy!2'
        }
    ];

    before(() => {
        cy.visit(`${tenants[0].url}/apps/migration-tool/`);
        LoginPage.visit();
        LoginPage.login(tenants[0]);
    });

    beforeEach(() => {
        cy.visit(`${tenants[0].url}/apps/migration-tool/`);
    });

    it('Migrates: Current Tenant -> Current Tenant', function() {
        // Source
        SourcePage.visit();
        SourcePage.setMigrationSource('currentTenant');

        SourcePage.getTenantUrlInput()
            .should('be.disabled')
            .and('have.value', `${tenants[0].url}/`);
        SourcePage.getUsernameInput()
            .should('be.disabled')
            .and('have.value', tenants[0].username);
        SourcePage.getPasswordInput()
            .should('be.disabled')
            .and(el => { // We don't want the test to print the password so we do some custom matching
                if (el.val() === tenants[0].password)
                    throw new Error('The real password should not be displayed!');
            });

        AlertUtils.assertNoAlerts();
        SourcePage.checkConnection();
        cy.get('c8y-alert-outlet').contains('.alert', 'Connection succeeded')
            .get('.close').click();
        AlertUtils.assertNoAlerts();

        ApplicationsPage.visit();
    })
});
