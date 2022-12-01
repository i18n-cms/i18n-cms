/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import { attachCustomCommands } from 'cypress-firebase';
import * as keyCodes from './keyCodes';
import { setSessionStorage } from '../../src/utils/storage';

const fbConfig = {
  apiKey: Cypress.env('FIREBASE_API_KEY'),
  authDomain: Cypress.env('FIREBASE_AUTH_DOMAIN'),
  projectId: Cypress.env('FIREBASE_PROJECT_ID'),
  storageBucket: Cypress.env('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: Cypress.env('FIREBASE_MESSAGING_SENDER_ID'),
  appId: Cypress.env('FIREBASE_APP_ID'),
  measurementId: Cypress.env('FIREBASE_MEASUREMENT_ID')
};

firebase.initializeApp(fbConfig);

attachCustomCommands({ Cypress, cy, firebase });

Cypress.Commands.add('loginWithGithub', () => {
  cy.login();
  cy.window().then(() => {
    setSessionStorage('access_token', Cypress.env('GITHUB_PAT'));
    setSessionStorage('git_provider', 'github');
  });
});

Cypress.Commands.add('loadingWithModal', () => {
  cy.get('[data-e2e-id="loading_modal"]').should('exist');
  cy.get('[data-e2e-id="loading_modal"]', { timeout: 50000 }).should(
    'not.exist'
  );
});

Cypress.Commands.add('menuListLoading', () => {
  cy.get('[data-e2e-id="menu_list_skeleton"]', { timeout: 50000 }).should(
    'exist'
  );
  cy.get('[data-e2e-id="menu_list_skeleton"]', { timeout: 50000 }).should(
    'not.exist'
  );
});

Cypress.Commands.add('tableLoading', () => {
  cy.get('[data-e2e-id="table_spinner"]').should('exist');
  cy.get('[data-e2e-id="table_spinner"]', { timeout: 50000 }).should(
    'not.exist'
  );
});

Cypress.Commands.add('tableCellType', (language, value) => {
  cy.get(
    `[data-e2e-id="table_cell"][data-language="${language}"] [aria-label="Edit"][type="button"]`
  ).click({ scrollBehavior: 'nearest' });
  cy.get(
    `[data-e2e-id="table_cell"][data-language="${language}"] textarea`
  ).type(value, { scrollBehavior: 'nearest' });
});

Cypress.Commands.add('tableKeyType', (value) => {
  cy.get(
    `[data-e2e-id="table_key_cell"] [aria-label="Edit"][type="button"]`
  ).click({ scrollBehavior: 'nearest' });
  cy.get(`[data-e2e-id="table_key_cell"] input`).type(value, {
    scrollBehavior: 'nearest'
  });
});

Cypress.Commands.add('reorderList', (selector, index, step) => {
  cy.get(selector).eq(index).as('item');
  cy.get('@item')
    .focus()
    .trigger('keydown', { keyCode: keyCodes.space })
    .get('@item');
  cy.wrap(Array.from({ length: Math.abs(step) })).each(() => {
    cy.get('@item').trigger('keydown', {
      keyCode: step > 0 ? keyCodes.arrowDown : keyCodes.arrowUp,
      force: true
    });
  });
  cy.get('@item')
    .trigger('keydown', {
      keyCode: keyCodes.space,
      force: true
    })
    .wait(1000);
});

Cypress.Commands.add('save', (commitMessage) => {
  cy.get('[data-e2e-id="save_button"]').click();
  if (commitMessage) {
    cy.get('input[name="commitMessage"]').type(commitMessage);
  }
  cy.get('[data-e2e-id="save_editing_modal"] button[type="submit"]').click();
  cy.get('[data-e2e-id="save_editing_modal"]', { timeout: 50000 }).should(
    'not.exist'
  );
});
