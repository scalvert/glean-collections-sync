import axios from 'axios';
import CollectionsManager from '../src/collections-manager';

jest.mock('axios', () => ({
  create: jest.fn()
}));

describe('CollectionsManager', () => {
  let collectionsManager: CollectionsManager;
  const apiUrl = 'http://api.glean.example';
  const apiToken = 'testToken123';
  const userEmail = 'test@example.com';

  beforeEach(() => {
    (axios.create as jest.Mock).mockClear();
    collectionsManager = new CollectionsManager(apiUrl, apiToken, userEmail);
  });

  describe('constructor', () => {
    it('should initialize with the correct properties', () => {
      expect(collectionsManager).toHaveProperty('gleanClientApiUrl', apiUrl);
      expect(collectionsManager).toHaveProperty(
        'gleanClientApiToken',
        apiToken
      );
      expect(collectionsManager).toHaveProperty('gleanUserEmail', userEmail);
    });
  });

  describe('getClient', () => {
    it('should return an Axios instance with the correct headers', () => {
      const mockAxiosInstance = {};
      (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

      const client = collectionsManager['getClient']();

      expect(axios.create).toHaveBeenCalledWith({
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'X-Scio-Actas': userEmail
        }
      });
      expect(client).toBe(mockAxiosInstance);
    });
  });

  describe('getUrl', () => {
    it('should construct and return the full API URL for a given path', () => {
      const path = 'test/path';
      const expectedUrl = `${apiUrl}/${path}`;
      const result = collectionsManager['getUrl'](path);

      expect(result).toBe(expectedUrl);
    });
  });

  describe('parseFilters', () => {
    it('should parse a filters string into a FilterDict object', () => {
      const filters = 'status:active category:news';
      const result = collectionsManager['parseFilters'](filters);

      expect(result).toMatchInlineSnapshot(`
{
  "category": [
    {
      "relationType": "EQUALS",
      "value": "news",
    },
  ],
  "status": [
    {
      "relationType": "EQUALS",
      "value": "active",
    },
  ],
}
`);
    });

    it('should return an empty object if filters string is empty', () => {
      const filters = '';
      const result = collectionsManager['parseFilters'](filters);

      expect(result).toMatchInlineSnapshot(`{}`);
    });

    it('should handle filters with multiple values for the same key', () => {
      const filters = 'status:active status:pending';
      const result = collectionsManager['parseFilters'](filters);

      expect(result).toMatchInlineSnapshot(`
{
  "status": [
    {
      "relationType": "EQUALS",
      "value": "active",
    },
    {
      "relationType": "EQUALS",
      "value": "pending",
    },
  ],
}
`);
    });
  });
});
