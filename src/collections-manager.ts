import axios, { AxiosInstance } from 'axios';

interface Config {
  GLEAN_CLIENT_API_URL: string;
  GLEAN_CLIENT_API_TOKEN: string;
  USE_KRAKEN_PROXY: boolean;
  KRAKEN_PROXY: { https: string };
}

interface Document {
  id: string;
  title: string;
  url: string;
}

interface Filter {
  value: string;
  relationType: string;
}

interface FilterDict {
  [key: string]: Filter[];
}

interface CollectionResponse {
  errorCode?: string;
  id?: string;
  collections?: Collection[];
}

interface Collection {
  id: string;
  name: string;
}

export default class CollectionsManager {
  private gleanClientApiUrl: string;
  private gleanClientApiToken: string;
  private client: AxiosInstance;

  constructor() {
    this.gleanClientApiUrl = gleanClientApiUrl;
    this.gleanClientApiToken = gleanClientApiToken;
    this.client = this.getClient();
  }

  private getClient(): AxiosInstance {
    const client = axios.create({
      headers: {
        Authorization: `Bearer ${this.gleanClientApiToken}`,
        'Content-Type': 'application/json',
        'X-Scio-Actas': 'scalvert@linkedin.com'
      }
    });

    return client;
  }

  private getUrl(path: string): string {
    return `${this.gleanClientApiUrl}/${path}`;
  }

  private parseFilters(filters: string): FilterDict {
    const filterDict: FilterDict = {};

    if (filters) {
      filters.split(' ').forEach((part) => {
        const [key, value] = part.split(':');
        if (filterDict[key]) {
          filterDict[key].push({ value, relationType: 'EQUALS' });
        } else {
          filterDict[key] = [{ value, relationType: 'EQUALS' }];
        }
      });
    }

    return filterDict;
  }

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

  private async callSearchApi(
    payload: Record<string, any>
  ): Promise<Record<string, any>> {
    const url = this.getUrl('search');
    const response = await this.client.post(url, payload);
    this.logRequestDetails(response);
    return response.data;
  }

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

    this.logRequestDetails(response);
    return response.data;
  }

  private async getAllCollections(): Promise<Collection[]> {
    const url = this.getUrl('listcollections');
    const response = await this.client.post(url);
    this.logRequestDetails(response);
    return response.data.collections;
  }

  private async findCollection(
    collectionName: string
  ): Promise<Collection | null> {
    const collections = await this.getAllCollections();
    return (
      collections.find((collection) => collection.name === collectionName) ||
      null
    );
  }

  private async getCollectionItems(
    collectionId: number
  ): Promise<Record<string, any>> {
    const url = this.getUrl('getcollection');
    const response = await this.client.post(url, {
      id: collectionId,
      withItems: true
    });
    this.logRequestDetails(response);
    return response.data;
  }

  private async addItemsToCollection(
    collectionId: number,
    items: Record<string, any>[]
  ): Promise<Record<string, any>> {
    const url = this.getUrl('addcollectionitems');
    const itemDescriptors = [];

    for (const item of items) {
      const payload = { collectionId, addedCollectionItemDescriptors: [item] };
      const response = await this.client.post(url, payload);
      this.logRequestDetails(response);
      itemDescriptors.push(item);
    }

    return { collectionId, addedCollectionItemDescriptors: itemDescriptors };
  }

  private async deleteCollectionItem(
    collectionId: number,
    itemId: string | null,
    documentId: string
  ): Promise<Record<string, any>> {
    const url = this.getUrl('deletecollectionitem');
    const payload = { collectionId, itemId, documentId };
    const response = await this.client.post(url, payload);
    this.logRequestDetails(response);
    return response.data;
  }

  public async syncCollection(
    collectionName: string,
    query: string,
    filters: string
  ): Promise<Record<string, any>> {
    const payload = this.createApiPayload(query, filters);
    const responseJson = await this.callSearchApi(payload);
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
      );
      const oldDocumentIds = existingDocumentIds.filter(
        (id) => !searchDocumentIds.includes(id)
      );

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

  private logRequestDetails(response: any): void {
    console.debug('Request Details:');
    console.debug(`Endpoint: ${response.config.url}`);
    console.debug(`Method: ${response.config.method}`);

    if (response.config.headers) {
      console.debug('Headers:');
      Object.entries(response.config.headers).forEach(([key, value]) => {
        console.debug(`${key}: ${value}`);
      });
    }

    if (response.config.data) {
      console.debug('Body:');
      console.debug(response.config.data);
    }

    console.debug(`Response Status Code: ${response.status}`);
    console.debug(`Response Body: ${response.data}`);
  }
}
