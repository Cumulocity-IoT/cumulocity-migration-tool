export class LoginPage {
    static visit() {
        cy.clearSessionStorage();
        cy.reload();
    }
    static login({id, username, password}) {
        cy.get('input[name=tenant]', {timeout: 10000}).type(id);
        cy.get('input[name=user]').type(username);
        cy.get('input[name=password]').type(password, { log: false });
        cy.get('button[type=submit]').click();
        cy.get('c8y-user-menu-outlet i.c8y-icon-user', {timeout: 10000}).should('be.visible');
    }
}
