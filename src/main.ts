import * as core from '@actions/core';
import CollectionsManager from './collections-manager';
import { CollectionSyncConfig } from './types';

export async function run(): Promise<void> {
  try {
    const gleanClientApiUrl = core.getInput('glean-client-api-url');
    const gleanClientApiToken = core.getInput('glean-client-api-token');
    const gleanUserEmail = core.getInput('glean-user-email', {
      required: true
    });
    const collectionsInput = core.getInput('collection-sync-configs', {
      required: true
    });

    const collectionSyncConfigs = JSON.parse(collectionsInput);

    const collectionsManager = new CollectionsManager(
      gleanClientApiUrl,
      gleanClientApiToken,
      gleanUserEmail
    );

    const results = await Promise.all(
      collectionSyncConfigs.map(
        async (collectionSyncConfig: CollectionSyncConfig) => {
          return collectionsManager.syncCollection(
            collectionSyncConfig.name,
            collectionSyncConfig.query,
            collectionSyncConfig.filters
          );
        }
      )
    );

    core.setOutput('result', results);
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}
