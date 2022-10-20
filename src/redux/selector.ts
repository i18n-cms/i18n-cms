import { createSelector } from '@reduxjs/toolkit';
import { groupBy, pickBy, mapValues } from 'lodash-es';
import { RootState } from './store';

export const isAuthSelector = createSelector(
  (state: RootState) => state.AppReducer.authState,
  (authState) => authState === 'signIn'
);

export const duplicatedKeySelector = createSelector(
  (state: RootState) => state.EditingRepoReducer.localeIds,
  (state: RootState) => state.EditingRepoReducer.modifiedLocalesData,
  (state: RootState, namespace?: string) =>
    namespace || state.EditingRepoReducer.selectedNamespace,
  (localeIds, modifiedLocalesData, namespace) => {
    if (!namespace || !modifiedLocalesData[namespace]) return {};
    const nestedKeyList: string[] = [];
    const keys = localeIds[namespace].map((localeId) => {
      const data = modifiedLocalesData[namespace][localeId];
      const { key } = data;
      if (key.split('.').length > 1) {
        nestedKeyList.push(data.key);
      }
      return data.key;
    });

    const keyCountMap = mapValues(groupBy(keys), (value) => value.length);

    nestedKeyList.forEach((nestedKey) => {
      const keyArray = nestedKey.split('.');
      keyArray.forEach((n, index) => {
        const key = keyArray.slice(0, index + 1).join('.');
        if (index === keyArray.length - 1) return;
        if (keyCountMap[key]) {
          keyCountMap[key]++;
          keyCountMap[nestedKey]++;
        }
      });
    });

    return pickBy(keyCountMap, (value) => value > 1);
  }
);

export const selectedLanguagesSelector = createSelector(
  (state: RootState) => state.EditingRepoReducer.languages,
  (state: RootState) => state.EditingRepoReducer.selectedLanguagesMap,
  (languages, selectedLanguagesMap) =>
    languages.filter((language) => selectedLanguagesMap[language])
);
