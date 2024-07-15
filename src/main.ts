import * as core from '@actions/core';
import CollectionsManager from './collections-manager';

export async function run(): Promise<void> {
  try {
    const gleanClientApiUrl = core.getInput('glean-client-api-url');
    const gleanClientApiToken = core.getInput('glean-client-api-token');
    const gleanUserEmail = core.getInput('glean-user-email', {
      required: true
    });
    const collectionName = core.getInput('collection-name', { required: true });
    const query = core.getInput('query', { required: true });
    const filters = core.getInput('filters', { required: true });

    const collectionsManager = new CollectionsManager(
      gleanClientApiUrl,
      gleanClientApiToken,
      gleanUserEmail
    );
    const response = await collectionsManager.syncCollection(
      collectionName,
      query,
      filters
    );

    core.setOutput('result', response);
  } catch (error) {
    core.setFailed(`Action failed with error: ${error}`);
  }
}
