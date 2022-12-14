import { mount } from 'cypress/react18';

declare global {
  namespace Cypress {
    interface Chainable {
      loadingWithModal(): Chainable<Element>;
      menuListLoading(): Chainable<Element>;
      tableLoading(): Chainable<Element>;
      tableCellType(language: string, value: string): Chainable<Element>;
      tableKeyType(value: string): Chainable<Element>;
      reorderList(
        selector: string,
        index: number,
        step: number
      ): Chainable<Element>;
      save(commitMessage?: string): Chainable<Element>;
      mount: typeof mount;
    }
  }
}
