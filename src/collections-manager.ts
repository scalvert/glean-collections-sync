import axios, { AxiosInstance } from 'axios';
import { FilterDict, CollectionResponse, Collection } from './types';

/**
 * Manages collections within the Glean application, providing functionality for
 * creating, updating, and syncing collections based on search queries and filters.
 */
export default class CollectionsManager {
  private gleanClientApiUrl: string;
  private gleanClientApiToken: string;
  private gleanUserEmail: string;
  private client: AxiosInstance;

  /**
   * Creates an instance of CollectionsManager.
   * @param {string} gleanClientApiUrl - The API URL for the Glean client.
   * @param {string} gleanClientApiToken - The API token for the Glean client.
   * @param {string} gleanUserEmail - The email of the Glean user.
   */
  constructor(
    gleanClientApiUrl: string,
    gleanClientApiToken: string,
    gleanUserEmail: string
  ) {
    this.gleanClientApiUrl = gleanClientApiUrl;
    this.gleanClientApiToken = gleanClientApiToken;
    this.gleanUserEmail = gleanUserEmail;
    this.client = this.getClient();
  }

  /**
   * Initializes and returns an Axios client instance with the appropriate headers.
   * @returns {AxiosInstance} - The configured Axios client instance.
   */
  private getClient(): AxiosInstance {
    const client = axios.create({
      headers: {
        Authorization: `Bearer ${this.gleanClientApiToken}`,
        'Content-Type': 'application/json',
        'X-Scio-Actas': this.gleanUserEmail
      }
    });

    return client;
  }

  /**
   * Constructs and returns the full API URL for a given path.
   * @param {string} path - The API endpoint path.
   * @returns {string} - The full API URL.
   */
  private getUrl(path: string): string {
    return `${this.gleanClientApiUrl}/${path}`;
  }

  /**
   * Parses a filters string into a FilterDict object.
   * @param {string} filters - The filters string to parse.
   * @returns {FilterDict} - The parsed filters dictionary.
   */
  private parseFilters(filters: string): FilterDict {
    const filterDict: FilterDict = {};

    if (filters) {
      for (const part of filters.split(' ')) {
        const [key, value] = part.split(':');

        if (filterDict[key]) {
          filterDict[key].push({ value, relationType: 'EQUALS' });
        } else {
          filterDict[key] = [{ value, relationType: 'EQUALS' }];
        }
      }
    }

    return filterDict;
  }

  /**
   * Creates the API payload for a search query and filters.
   * @param {string} query - The search query.
   * @param {string} filters - The filters to apply to the search.
   * @returns {Record<string, any>} - The payload object for the API request.
   */
  private createApiPayload(
    query: string,
    filters: string
  ): Record<string, any> {
    const filterDict = this.parseFilters(filters);
    const facetFilters = Object.entries(filterDict).map(([key, values]) => ({
      fieldName: key,
      values
    }));

    const payload: Record<string, any> = {
      pageSize: 1000,
      requestOptions: { facetFilters }
    };

    if (query) {
      payload.query = query;
    }

    return payload;
  }

  /**
   * Executes a search query with the specified filters and returns the search results.
   * @param {string} query - The search query.
   * @param {string} filters - The filters to apply to the search.
   * @returns {Promise<Record<string, any>>} - The search results.
   */
  private async doSearch(
    query: string,
    filters: string
  ): Promise<Record<string, any>> {
    const url = this.getUrl('search');
    const payload = this.createApiPayload(query, filters);
    const response = await this.client.post(url, payload);

    return response.data;
  }

  /**
   * Extracts document details from the search result items.
   * @param {Record<string, any>[]} items - The search result items.
   * @returns {Record<string, any>[]} - The extracted document details.
   */
  private getDocumentDetails(
    items: Record<string, any>[]
  ): Record<string, any>[] {
    return items.map((item) => {
      const document = item.document;
      const itemType = item.itemType || 'DOCUMENT';

      return {
        documentId: document.id,
        name: document.title,
        title: document.title,
        url: document.url,
        itemType
      };
    });
  }

  /**
   * Creates a new collection with the given name.
   * @param {string} collectionName - The name of the collection to create.
   * @returns {Promise<CollectionResponse>} - The response from the API.
   */
  private async createCollection(
    collectionName: string
  ): Promise<CollectionResponse> {
    const url = this.getUrl('createcollection');
    const payload = { name: collectionName };
    const response = await this.client.post(url, payload);

    if (
      response.status === 422 &&
      response.data?.error?.errorCode === 'NAME_EXISTS'
    ) {
      return { errorCode: 'NAME_EXISTS', id: response.data.id };
    }

    return response.data;
  }

  /**
   * Retrieves all collections.
   * @returns {Promise<Collection[]>} - A list of all collections.
   */
  private async getAllCollections(): Promise<Collection[]> {
    const url = this.getUrl('listcollections');
    const response = await this.client.post(url);

    return response.data.collections;
  }

  /**
   * Finds a collection by name.
   * @param {string} collectionName - The name of the collection to find.
   * @returns {Promise<Collection | null>} - The found collection or null if not found.
   */
  private async findCollection(
    collectionName: string
  ): Promise<Collection | null> {
    const collections = await this.getAllCollections();

    return (
      collections.find((collection) => collection.name === collectionName) ||
      null
    );
  }

  /**
   * Retrieves the items of a collection by collection ID.
   * @param {number} collectionId - The ID of the collection to retrieve items for.
   * @returns {Promise<Record<string, any>>} - The collection items.
   */
  private async getCollectionItems(
    collectionId: number
  ): Promise<Record<string, any>> {
    const url = this.getUrl('getcollection');
    const response = await this.client.post(url, {
      id: collectionId,
      withItems: true
    });

    return response.data;
  }

  /**
   * Adds items to a collection.
   * @param {number} collectionId - The ID of the collection to add items to.
   * @param {Record<string, any>[]} items - The items to add to the collection.
   * @returns {Promise<Record<string, any>>} - The response from the API.
   */
  private async addItemsToCollection(
    collectionId: number,
    items: Record<string, any>[]
  ): Promise<Record<string, any>> {
    const url = this.getUrl('addcollectionitems');
    const itemDescriptors = [];

    for (const item of items) {
      const payload = { collectionId, addedCollectionItemDescriptors: [item] };
      await this.client.post(url, payload);

      itemDescriptors.push(item);
    }

    return { collectionId, addedCollectionItemDescriptors: itemDescriptors };
  }

  /**
   * Deletes an item from a collection.
   * @param {number} collectionId - The ID of the collection.
   * @param {string | null} itemId - The ID of the item to delete.
   * @param {string} documentId - The ID of the document to delete.
   * @returns {Promise<Record<string, any>>} - The response from the API.
   */
  private async deleteCollectionItem(
    collectionId: number,
    itemId: string | null,
    documentId: string
  ): Promise<Record<string, any>> {
    const url = this.getUrl('deletecollectionitem');
    const payload = { collectionId, itemId, documentId };
    const response = await this.client.post(url, payload);

    return response.data;
  }

  /**
   * Syncs the specified collection with the search results from the provided query and filters.
   * Adds new documents to the collection, and removes documents no longer in the search results.
   * @param {string} collectionName - The name of the collection to sync.
   * @param {string} query - The search query.
   * @param {string} filters - The filters to apply to the search.
   * @returns {Promise<Record<string, any>>} - The result of the sync operation.
   */
  public async syncCollection(
    collectionName: string,
    query: string,
    filters: string
  ): Promise<Record<string, any>> {
    const responseJson = await this.doSearch(query, filters);
    const documentDetails = this.getDocumentDetails(responseJson.results || []);
    const searchDocumentIds = documentDetails.map((doc) => doc.documentId);

    const collectionResponse = await this.createCollection(collectionName);

    if (collectionResponse.errorCode === 'NAME_EXISTS') {
      const existingCollection = await this.findCollection(collectionName);
      if (!existingCollection) {
        return { error: `Collection '${collectionName}' not found.` };
      }

      const collectionId = existingCollection.id;
      const existingItemsResponse = await this.getCollectionItems(collectionId);
      const existingDocumentIds = this.getDocumentDetails(
        existingItemsResponse.items || []
      ).map((doc) => doc.documentId);

      const newDocumentIds = searchDocumentIds.filter(
        (id) => !existingDocumentIds.includes(id)
      ) as string[];
      const oldDocumentIds = existingDocumentIds.filter(
        (id) => !searchDocumentIds.includes(id)
      ) as string[];

      if (newDocumentIds.length) {
        const newDocuments = documentDetails.filter((doc) =>
          newDocumentIds.includes(doc.documentId)
        );
        await this.addItemsToCollection(collectionId, newDocuments);
      }

      if (oldDocumentIds.length) {
        for (const docId of oldDocumentIds) {
          await this.deleteCollectionItem(collectionId, null, docId);
        }
      }

      return {
        message: `Updated existing collection '${collectionName}'`,
        collection_id: collectionId,
        collection_name: collectionName,
        added_documents: newDocumentIds.sort(),
        removed_documents: oldDocumentIds.sort()
      };
    }

    const collectionId = collectionResponse.id;

    if (collectionId) {
      await this.addItemsToCollection(collectionId, documentDetails);
      return {
        message: `Created new collection '${collectionName}'`,
        collection_id: collectionId,
        collection_name: collectionName,
        added_documents: searchDocumentIds
      };
    }

    return { error: 'Error creating collection' };
  }
}
