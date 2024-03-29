import {
  deleteAllTag,
  deleteRepo,
  deleteRepoFromMenu,
  ERROR_MSG_CLASS,
  getOwner,
  gitProviders,
  login,
  logout,
  TOAST_CLASS
} from '../../support/utils';
import MenuWording from '../../../public/locales/en/menu.json';

gitProviders.map((gitProvider) => {
  describe(`create repo - ${gitProvider}`, () => {
    before(() => {
      login(gitProvider);
    });
    beforeEach(() => {
      cy.visit('/menu');
      cy.get('[data-e2e-id="app"]').should('exist');
      cy.get('[data-e2e-id="add_repo_button"]').click();
      cy.get('[data-e2e-id="add_repo_create"]').click();
    });
    after(() => {
      logout();
    });

    it('test required field', () => {
      deleteAllTag('languages');
      deleteAllTag('namespaces');
      cy.get('input[name="pattern"]').clear();
      cy.get('button[type="submit"]', { timeout: 50000 }).should('be.enabled');
      cy.get('button[type="submit"]').click();
      cy.get('input[name="name"]:invalid').should('exist');
      cy.get('input[name="pattern"]:invalid').should('exist');
      cy.get('select[name="defaultLanguage"]:invalid').should('exist');
      cy.get('input[data-e2e-id="languages-tag-input"]:invalid').should(
        'exist'
      );
      cy.get('input[data-e2e-id="namespaces-tag-input"]:invalid').should(
        'exist'
      );
    });

    it('test create repo', () => {
      const CREATE_REPO_NAME = 'mock-create-repo';
      const CREATE_REPO_FULL_NAME = `${getOwner(
        gitProvider
      )}/${CREATE_REPO_NAME}`;
      deleteRepo({ gitProvider, repo: CREATE_REPO_NAME });
      cy.get('input[name="name"]').type(CREATE_REPO_NAME);
      cy.get('button[type="submit"]', { timeout: 50000 }).should('be.enabled');
      cy.get('button[type="submit"]').click();
      cy.loadingWithModal();
      cy.location('pathname', { timeout: 50000 }).should('eq', '/repo');

      // Click existing repo
      cy.visit('/menu');
      cy.contains('[data-e2e-id="menu_repo_card"]', CREATE_REPO_NAME).click();
      cy.loadingWithModal();
      cy.location('pathname', { timeout: 50000 }).should('eq', '/repo');

      deleteRepo({ gitProvider, repo: CREATE_REPO_NAME });

      // Click removed repo
      cy.visit('/menu');
      cy.menuListLoading();
      cy.contains(
        '[data-e2e-id="menu_repo_card"]',
        CREATE_REPO_FULL_NAME
      ).click();
      cy.loadingWithModal();
      cy.get(TOAST_CLASS).should(
        'contain.text',
        MenuWording['Please import repo again']
      );
      cy.menuListLoading();
      cy.contains(CREATE_REPO_FULL_NAME).should('not.exist');
    });

    it('test create repo repeated', () => {
      const IMPORT_REPO_NAME = 'mock-import-repo';
      cy.get('input[name="name"]').type(IMPORT_REPO_NAME);
      cy.get('button[type="submit"]').click();
      cy.loadingWithModal();
      cy.get('input[name="name"][aria-invalid="true"]').should('exist');
      cy.get(
        `input[name="name"][aria-invalid="true"] + ${ERROR_MSG_CLASS}`
      ).should(
        'have.text',
        MenuWording['Repository name already exists on this owner']
      );
    });

    it('test create repo in org', () => {
      const org = 'i18n-cms-test-org';
      const repoName = 'new_repo_in_org';

      deleteRepo({ gitProvider, repo: repoName, owner: org });

      cy.get('select[data-e2e-id="owner_select"]', { timeout: 50000 }).select(
        org
      );
      cy.get('input[name="name"]').type(repoName);
      cy.get('button[type="submit"]').click();
      cy.loadingWithModal();
      cy.location('pathname', { timeout: 50000 }).should('eq', '/repo');
      deleteRepoFromMenu({ gitProvider, repo: repoName, owner: org });
    });
  });
});
